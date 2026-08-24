import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function generatePdfWithPythonEngine(inputSrc: string, docTitle: string): Promise<{ pdfBuffer: Buffer; pageCount: number }> {
  const tmpDir = path.resolve(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const id = Math.random().toString(36).substring(2, 9);
  const tmpInput = path.join(tmpDir, `input_${id}.html`);
  const tmpPdf = path.join(tmpDir, `output_${id}.pdf`);

  try {
    let arg = inputSrc;
    if (!inputSrc.startsWith('http://') && !inputSrc.startsWith('https://')) {
      fs.writeFileSync(tmpInput, inputSrc, 'utf-8');
      arg = tmpInput;
    }

    const scriptPath = path.resolve(__dirname, 'build_pdf_engine.py');
    const pyCmd = `python3 "${scriptPath}" "${arg.replace(/"/g, '\\"')}" "${tmpPdf}"`;
    
    const { stdout } = await execAsync(pyCmd, { maxBuffer: 50 * 1024 * 1024 });

    let pageCount = 1;
    try {
      const match = stdout.match(/\{.*"pageCount":\s*(\d+).*\}/);
      if (match) {
        const meta = JSON.parse(match[0]);
        pageCount = meta.pageCount || 1;
      }
    } catch {}

    if (fs.existsSync(tmpPdf)) {
      const pdfBuffer = fs.readFileSync(tmpPdf);
      try {
        if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
        if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
      } catch {}

      return { pdfBuffer, pageCount };
    } else {
      throw new Error('PDF output file was not generated');
    }
  } catch (err: any) {
    try {
      if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
      if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
    } catch {}
    throw err;
  }
}

function scribdApiPlugin(): Plugin {
  const handleApiRequest = async (req: any, res: any) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.statusCode = 204;
      return res.end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => (body += chunk));
      req.on('end', async () => {
        try {
          const { url, htmlContent } = JSON.parse(body || '{}');
          const inputSrc = url || htmlContent;

          if (!inputSrc) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing url or htmlContent' }));
          }

          const { pdfBuffer, pageCount } = await generatePdfWithPythonEngine(inputSrc, 'Scribd Document');
          const pdfBase64 = pdfBuffer.toString('base64');
          const sizeBytes = pdfBuffer.length;

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              pdfBase64: `data:application/pdf;base64,${pdfBase64}`,
              pageCount,
              sizeBytes,
            })
          );
        } catch (e: any) {
          console.error('API Error:', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: e.message || 'PDF Generation Failed' }));
        }
      });
    }
  };

  return {
    name: 'scribd-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/process-pdf', handleApiRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/process-pdf', handleApiRequest);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), scribdApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
