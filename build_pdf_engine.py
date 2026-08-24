import os
import sys
import urllib.request
import gzip
import re
import time
import json
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFont
import io

def parse_px(val_str):
    if not val_str:
        return 0.0
    m = re.search(r'(-?\d+(?:\.\d+)?)px', val_str)
    return float(m.group(1)) if m else 0.0

def parse_clip_rect(clip_str):
    if not clip_str or 'rect' not in clip_str:
        return None
    m = re.search(r'rect\s*\(\s*(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s*\)', clip_str)
    if m:
        return (int(m.group(4)), int(m.group(1)), int(m.group(2)), int(m.group(3))) # left, top, right, bottom
    return None

def build_pdf_from_html(html_content, output_pdf_path, font_path=None):
    if not font_path or not os.path.exists(font_path):
        font_path = '/mnt/data/projects/free-Scribd/python-version-simple/fonts/NotoSansDevanagari.ttf'
    
    # Extract access token
    tokens = re.findall(r'token=([A-Za-z0-9\._\-]+)', html_content)
    token = tokens[0] if tokens else ''

    # Extract page JSONP links
    pages_jsonp = re.findall(r'https?://html\.scribdassets\.com/([^/]+)/pages/(\d+)-([a-f0-9]+)\.jsonp', html_content)
    
    pages_dict = {}
    for p in pages_jsonp:
        p_num = int(p[1])
        if p_num not in pages_dict:
            pages_dict[p_num] = (p[0], p[1], p[2])

    sorted_pnums = sorted(pages_dict.keys())
    total_pages = len(sorted_pnums)
    if total_pages == 0:
        raise ValueError("No valid Scribd document pages found in the HTML content")

    page_images_data = {}
    page_texts_data = {}
    page_dimensions_data = {}

    def fetch_page_data(p_num):
        doc_id, p_str, p_hash = pages_dict[p_num]
        jsonp_url = f'https://html.scribdassets.com/{doc_id}/pages/{p_str}-{p_hash}.jsonp'
        req = urllib.request.Request(jsonp_url, headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    raw = resp.read()
                    data = gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw
                    text = data.decode('utf-8', errors='ignore')
                    
                    json_start = text.find('[')
                    json_end = text.rfind(']')
                    img_specs = []
                    text_items = []
                    p_width, p_height = 878.0, 1168.0

                    if json_start != -1 and json_end != -1:
                        try:
                            json_str = text[json_start:json_end+1]
                            html_str = json.loads(json_str)[0]
                            soup = BeautifulSoup(html_str, 'html.parser')
                            
                            newpage_div = soup.find(class_='newpage')
                            if newpage_div and newpage_div.get('style'):
                                w_m = re.search(r'width:\s*(\d+)px', newpage_div['style'])
                                h_m = re.search(r'height:\s*(\d+)px', newpage_div['style'])
                                if w_m and h_m:
                                    p_width = float(w_m.group(1))
                                    p_height = float(h_m.group(1))
                            
                            # Extract absimg images from image_layer (1X resolution)
                            img_layer = soup.find(class_='image_layer')
                            if img_layer:
                                for img in img_layer.find_all('img'):
                                    orig = img.get('orig') or img.get('src') or ''
                                    if orig:
                                        orig_url = orig.replace('http://html.scribd.com', 'https://html.scribdassets.com')
                                        orig_url = orig_url.replace('http://html.scribdassets.com', 'https://html.scribdassets.com')
                                        if token and 'token=' not in orig_url:
                                            orig_url += f'?token={token}'
                                        
                                        style = img.get('style', '')
                                        # image_layer coordinates are 1x
                                        left = parse_px(re.search(r'left:\s*(-?\d+px)', style).group(0) if 'left:' in style else '0px')
                                        top = parse_px(re.search(r'top:\s*(-?\d+px)', style).group(0) if 'top:' in style else '0px')
                                        width = parse_px(re.search(r'width:\s*(\d+px)', style).group(0) if 'width:' in style else '0px')
                                        height = parse_px(re.search(r'height:\s*(\d+px)', style).group(0) if 'height:' in style else '0px')
                                        clip_box = parse_clip_rect(style)
                                        
                                        img_specs.append({
                                            'url': orig_url,
                                            'left': left,
                                            'top': top,
                                            'width': width,
                                            'height': height,
                                            'clip': clip_box
                                        })

                            # Extract text items from text_layer (5X scaled by 0.2)
                            text_layer = soup.find(class_='text_layer')
                            if text_layer:
                                for div in text_layer.find_all('div'):
                                    div_style = div.get('style', '')
                                    font_size = 14.0
                                    fs_m = re.search(r'font-size:\s*(\d+)px', div_style)
                                    if fs_m:
                                        font_size = max(6.0, float(fs_m.group(1)) * 0.2)
                                    
                                    for span in div.find_all('span', recursive=False):
                                        s_style = span.get('style', '')
                                        left_m = re.search(r'left:\s*(-?\d+)px', s_style)
                                        top_m = re.search(r'top:\s*(-?\d+)px', s_style)
                                        if left_m or top_m:
                                            left = float(left_m.group(1)) * 0.2 if left_m else 0.0
                                            top = float(top_m.group(1)) * 0.2 if top_m else 0.0
                                            raw_t = span.get_text()
                                            clean_t = ''.join([ch for ch in raw_t if ord(ch) < 0xE000 or ord(ch) > 0xF8FF]).strip()
                                            if clean_t:
                                                text_items.append((left, top, font_size, clean_t))
                        except Exception:
                            pass

                    # Fallback full page image if no absimg layers found
                    if not img_specs:
                        fallback_img = f'https://html.scribdassets.com/{doc_id}/images/{p_str}-{p_hash}.jpg{("?token=" + token) if token else ""}'
                        img_specs.append({
                            'url': fallback_img,
                            'left': 0.0,
                            'top': 0.0,
                            'width': p_width,
                            'height': p_height,
                            'clip': None
                        })

                    page_dimensions_data[p_num] = (p_width, p_height)
                    page_images_data[p_num] = img_specs
                    page_texts_data[p_num] = text_items
                    return
            except Exception:
                time.sleep(0.3)

    # Step 1: Download JSONPs in parallel
    with ThreadPoolExecutor(max_workers=25) as executor:
        executor.map(fetch_page_data, sorted_pnums)

    # Step 2: Render Page Images & Visible Text via PIL
    compiled_images = []
    asset_image_cache = {}

    def fetch_image_asset(url):
        if url in asset_image_cache:
            return asset_image_cache[url]
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                img_data = resp.read()
                img = Image.open(io.BytesIO(img_data)).convert('RGBA')
                asset_image_cache[url] = img
                return img
        except Exception:
            asset_image_cache[url] = None
            return None

    for p in sorted_pnums:
        p_w_f, p_h_f = page_dimensions_data.get(p, (878.0, 1168.0))
        p_w, p_h = int(p_w_f), int(p_h_f)
        
        page_img = Image.new('RGBA', (p_w, p_h), color=(255, 255, 255, 255))
        
        img_specs = page_images_data.get(p, [])
        for spec in img_specs:
            img_obj = fetch_image_asset(spec['url'])
            if img_obj:
                try:
                    tile_img = img_obj.copy()
                    if spec['clip']:
                        c_left, c_top, c_right, c_bottom = spec['clip']
                        c_left = max(0, min(c_left, tile_img.width))
                        c_top = max(0, min(c_top, tile_img.height))
                        c_right = max(c_left, min(c_right, tile_img.width))
                        c_bottom = max(c_top, min(c_bottom, tile_img.height))
                        if c_right > c_left and c_bottom > c_top:
                            tile_img = tile_img.crop((c_left, c_top, c_right, c_bottom))
                    
                    target_w = int(spec['width']) if spec['width'] > 0 else tile_img.width
                    target_h = int(spec['height']) if spec['height'] > 0 else tile_img.height
                    
                    if target_w > 0 and target_h > 0 and (tile_img.width != target_w or tile_img.height != target_h):
                        tile_img = tile_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
                    
                    pos_x = int(spec['left'])
                    pos_y = int(spec['top'])
                    page_img.alpha_composite(tile_img, dest=(pos_x, pos_y))
                except Exception:
                    pass

        page_rgb = page_img.convert('RGB')
        draw = ImageDraw.Draw(page_rgb)
        font_cache = {}

        items = page_texts_data.get(p, [])
        for left, top, font_size, text_str in items:
            f_size_int = max(8, int(font_size))
            if f_size_int not in font_cache:
                try:
                    font_cache[f_size_int] = ImageFont.truetype(font_path, f_size_int)
                except Exception:
                    font_cache[f_size_int] = ImageFont.load_default()
            
            font = font_cache[f_size_int]
            draw.text((int(left), int(top)), text_str, font=font, fill=(0, 0, 0))

        compiled_images.append(page_rgb)

    # Step 3: Save PDF file
    if compiled_images:
        compiled_images[0].save(
            output_pdf_path,
            "PDF",
            resolution=100.0,
            save_all=True,
            append_images=compiled_images[1:]
        )
        return total_pages
    else:
        raise ValueError("Failed to compile document page images")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 build_pdf_engine.py <input_url_or_html_file> <output_pdf_path>")
        sys.exit(1)
    
    input_src = sys.argv[1]
    out_pdf = sys.argv[2]

    if input_src.startswith('http://') or input_src.startswith('https://'):
        req = urllib.request.Request(input_src, headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
    elif os.path.exists(input_src):
        with open(input_src, 'r', encoding='utf-8', errors='ignore') as f:
            html = f.read()
    else:
        html = input_src

    pages_count = build_pdf_from_html(html, out_pdf)
    print(json.dumps({"success": True, "pageCount": pages_count, "pdfPath": out_pdf}))
