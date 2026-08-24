import os
import sys
import urllib.request
import gzip
import re
import time
import json
import shutil
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
import fitz  # PyMuPDF

HTML_PATH = '/mnt/data/others/pdf.html'
PAGES_DIR = '/mnt/data/others/scribd_pages'
FINAL_PDF = '/mnt/data/others/All_Diseases_and_Their_Treatment.pdf'
FONT_PATH = '/mnt/data/others/fonts/NotoSansDevanagari.ttf'

os.makedirs(PAGES_DIR, exist_ok=True)

print("Step 1: Parsing pdf.html metadata...")
with open(HTML_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

tokens = re.findall(r'token=([A-Za-z0-9\._\-]+)', html)
token = tokens[0] if tokens else ''

pages_jsonp = re.findall(r'https?://html\.scribdassets\.com/([^/]+)/pages/(\d+)-([a-f0-9]+)\.jsonp', html)
pages_dict = {int(p[1]): (p[0], p[1], p[2]) for p in pages_jsonp}
total_pages = len(pages_dict)
print(f"Total document pages to process: {total_pages}")

page_images = {}
page_texts = {}

def process_page_jsonp(p):
    doc_id, p_num, p_hash = pages_dict[p]
    url = f'https://html.scribdassets.com/{doc_id}/pages/{p_num}-{p_hash}.jsonp'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                data = gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw
                text = data.decode('utf-8', errors='ignore')
                
                # Image filename
                imgs = re.findall(r'images/(\d+-[a-f0-9]+\.(?:jpg|png))', text)
                if imgs:
                    ext = imgs[0].split('.')[-1]
                    img_filename = imgs[0]
                    img_url = f'https://html.scribdassets.com/{doc_id}/images/{img_filename}?token={token}'
                else:
                    ext = 'jpg'
                    img_filename = f'{p_num}-{p_hash}.jpg'
                    img_url = f'https://html.scribdassets.com/{doc_id}/images/{img_filename}?token={token}'
                
                page_images[p] = (img_filename, img_url, ext)
                
                img_path = os.path.join(PAGES_DIR, f"page_{p:04d}.{ext}")
                if not os.path.exists(img_path):
                    try:
                        img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(img_req, timeout=20) as img_resp:
                            with open(img_path, 'wb') as img_f:
                                img_f.write(img_resp.read())
                    except Exception:
                        pass
                
                # Parse Text items with coordinates
                text_items = []
                json_start = text.find('[')
                json_end = text.rfind(']')
                if json_start != -1 and json_end != -1:
                    json_str = text[json_start:json_end+1]
                    try:
                        html_content = json.loads(json_str)[0]
                        soup = BeautifulSoup(html_content, 'html.parser')
                        
                        newpage_div = soup.find(class_='newpage')
                        p_width, p_height = 878.0, 1168.0
                        if newpage_div and newpage_div.get('style'):
                            w_match = re.search(r'width:\s*(\d+)px', newpage_div['style'])
                            h_match = re.search(r'height:\s*(\d+)px', newpage_div['style'])
                            if w_match and h_match:
                                p_width = float(w_match.group(1))
                                p_height = float(h_match.group(1))
                        
                        text_layer = soup.find(class_='text_layer')
                        if text_layer:
                            for div in text_layer.find_all('div'):
                                style = div.get('style', '')
                                font_size = 14.0
                                if 'font-size:' in style:
                                    fs_match = re.search(r'font-size:\s*(\d+)px', style)
                                    if fs_match:
                                        font_size = max(6.0, float(fs_match.group(1)) * 0.2)
                                
                                for span in div.find_all('span', recursive=False):
                                    s_style = span.get('style', '')
                                    left_m = re.search(r'left:\s*(-?\d+)px', s_style)
                                    top_m = re.search(r'top:\s*(-?\d+)px', s_style)
                                    if left_m or top_m:
                                        left = float(left_m.group(1)) * 0.2 if left_m else 0.0
                                        top = float(top_m.group(1)) * 0.2 if top_m else 0.0
                                        raw_text = span.get_text()
                                        clean_text = ''.join([ch for ch in raw_text if ord(ch) < 0xE000 or ord(ch) > 0xF8FF]).strip()
                                        if clean_text:
                                            text_items.append((left, top, font_size, clean_text, p_width, p_height))
                    except Exception:
                        pass
                
                page_texts[p] = text_items
                return
        except Exception:
            time.sleep(0.5)

print("\nStep 2: Parsing JSONP text layers in parallel...")
t0 = time.time()
with ThreadPoolExecutor(max_workers=30) as executor:
    executor.map(process_page_jsonp, range(1, total_pages + 1))

t1 = time.time()
print(f"Parsed text for {len(page_texts)} / {total_pages} pages in {t1 - t0:.2f} seconds.")

print("\nStep 3: Assembling FINAL PDF with VISIBLE NotoSansDevanagari text layer...")
doc = fitz.open()

for p in range(1, total_pages + 1):
    doc_id, p_num, p_hash = pages_dict[p]
    img_info = page_images.get(p)
    ext = img_info[2] if img_info else 'jpg'
    img_path = os.path.join(PAGES_DIR, f"page_{p:04d}.{ext}")
    if not os.path.exists(img_path):
        alt_ext = 'png' if ext == 'jpg' else 'jpg'
        img_path = os.path.join(PAGES_DIR, f"page_{p:04d}.{alt_ext}")
    
    items = page_texts.get(p, [])
    p_w, p_h = 878.0, 1168.0
    if items and len(items[0]) >= 6:
        p_w, p_h = items[0][4], items[0][5]
    
    pdf_page = doc.new_page(width=p_w, height=p_h)
    
    # 1. Background Image
    if os.path.exists(img_path):
        pdf_page.insert_image(fitz.Rect(0, 0, p_w, p_h), filename=img_path)
    
    # 2. VISIBLE Text Layer (render_mode=0, solid black, full NotoSansDevanagari font)
    for left, top, font_size, text_str, _, _ in items:
        point = fitz.Point(left, top + font_size * 0.8)
        try:
            pdf_page.insert_text(
                point,
                text_str,
                fontsize=font_size,
                fontfile=FONT_PATH,
                fontname='NotoDeva',
                color=(0, 0, 0),
                render_mode=0
            )
        except Exception:
            pass

    if p % 100 == 0 or p == total_pages:
        print(f"Processed page {p} / {total_pages}...")

print("Saving final PDF...")
# Remove temporary file if exists
if os.path.exists(FINAL_PDF):
    try:
        os.remove(FINAL_PDF)
    except Exception:
        pass

doc.save(FINAL_PDF)
doc.close()

t1 = time.time()
pdf_size = os.path.getsize(FINAL_PDF) / (1024 * 1024)
print(f"\nSUCCESS! Created 1 Final PDF at: {FINAL_PDF}")
print(f"PDF File Size: {pdf_size:.2f} MB")
print(f"Total Pages: {total_pages}")

# Step 4: Cleanup all temporary files
print("\nStep 4: Cleaning up temporary files and directories...")
to_remove_files = [
    '/mnt/data/others/All_Diseases_and_Their_Treatment_Searchable.pdf',
    '/mnt/data/others/All_Diseases_and_Their_Treatment_Topmost_Text.pdf',
    '/mnt/data/others/test_pages.html',
    '/mnt/data/others/test_chrome.pdf',
    '/mnt/data/others/test_visible.pdf',
    '/mnt/data/others/test_dejavu.pdf',
    '/mnt/data/others/test_visible_deva.pdf',
    '/mnt/data/others/test_visible_topmost.pdf',
    '/mnt/data/others/test_fixed_hindi.pdf',
    '/mnt/data/others/test_page5_hindi.pdf',
    '/mnt/data/others/test_native.html',
    '/mnt/data/others/test_native.pdf',
    '/mnt/data/others/download_pages.py',
    '/mnt/data/others/build_pdf.py',
    '/mnt/data/others/build_searchable_pdf.py',
    '/mnt/data/others/build_topmost_visible_pdf.py',
    '/mnt/data/others/build_perfect_searchable_pdf.py'
]

for fpath in to_remove_files:
    if os.path.exists(fpath):
        try:
            os.remove(fpath)
            print(f"Removed temporary file: {fpath}")
        except Exception:
            pass

if os.path.exists(PAGES_DIR):
    try:
        shutil.rmtree(PAGES_DIR)
        print(f"Removed temporary directory: {PAGES_DIR}")
    except Exception:
        pass

print("\n--- CLEANUP COMPLETE. Only 1 Final PDF remains! ---")
