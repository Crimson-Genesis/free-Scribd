import React, { useEffect, useRef } from 'react';

interface ParticleCanvasProps {
  darkMode: boolean;
}

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({ darkMode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const maxParticles = 90;

    // Strict black/white and neutral monochrome gray shades
    const colors = darkMode
      ? ['#ffffff', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#737373', '#525252', '#333333']
      : ['#000000', '#171717', '#262626', '#404040', '#525252', '#737373', '#a3a3a3'];

    function hexToRGBA(hex: string, alpha: number) {
      let cleanHex = hex.replace('#', '');
      if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map((c) => c + c).join('');
      }
      const red = parseInt(cleanHex.substring(0, 2), 16);
      const green = parseInt(cleanHex.substring(2, 4), 16);
      const blue = parseInt(cleanHex.substring(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    class Particle {
      type: 'bubble' | 'line';
      coords: { x: number; y: number };
      velocity: { x: number; y: number };
      alpha: number;
      hex: string;
      color: string;
      strokeWidth: number;
      diameter: number = 0;
      angle: number = 0;
      length: number = 0;
      rotateSpeed: number = 0;
      rotateClockwise: boolean = false;

      constructor(canvasWidth: number, canvasHeight: number) {
        this.type = Math.random() < 0.25 ? 'line' : 'bubble';
        this.coords = {
          x: Math.random() * canvasWidth,
          y: Math.random() * canvasHeight,
        };
        // Slow down floating speed (gentle, smooth drift)
        this.velocity = {
          x: (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 0.22 + 0.08),
          y: (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 0.22 + 0.08),
        };
        this.alpha = 0.05;
        this.hex = colors[Math.floor(Math.random() * colors.length)];
        this.color = hexToRGBA(this.hex, this.alpha);
        this.strokeWidth = Math.random() * 1.8 + 0.8;

        if (this.type === 'bubble') {
          this.diameter = Math.max(2, Math.random() * 5 + 2);
        } else {
          this.angle = Math.atan2(this.coords.y, this.coords.x);
          const lengths = [6, 10, 14, 18];
          this.length = lengths[Math.floor(Math.random() * lengths.length)];
          // Slower rotation speed
          const speeds = [140, 240, 360, 480];
          this.rotateSpeed = speeds[Math.floor(Math.random() * speeds.length)];
          this.rotateClockwise = Math.random() < 0.5;
        }
      }

      update(canvasWidth: number, canvasHeight: number): boolean {
        if (this.alpha < 0.6) {
          this.alpha += 0.004;
          this.color = hexToRGBA(this.hex, this.alpha);
        }

        this.coords.x += this.velocity.x;
        this.coords.y += this.velocity.y;

        if (this.type === 'line') {
          const angleDelta = Math.PI / this.rotateSpeed;
          this.angle += this.rotateClockwise ? -angleDelta : angleDelta;
        }

        return !(
          this.coords.x < -20 ||
          this.coords.x > canvasWidth + 20 ||
          this.coords.y < -20 ||
          this.coords.y > canvasHeight + 20
        );
      }

      draw(context: CanvasRenderingContext2D) {
        context.lineWidth = this.strokeWidth;
        context.strokeStyle = this.color;
        context.save();

        if (this.type === 'line') {
          context.translate(this.coords.x, this.coords.y);
          context.rotate(this.angle);
          context.beginPath();
          context.moveTo(-this.length / 2, 0);
          context.lineTo(this.length / 2, 0);
        } else {
          context.beginPath();
          context.arc(this.coords.x, this.coords.y, this.diameter, 0, Math.PI * 2, false);
        }

        context.stroke();
        context.restore();
      }
    }

    const updateCanvasSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      
      ctx.scale(dpr, dpr);
    };

    const getLogicalWidth = () => window.innerWidth;
    const getLogicalHeight = () => window.innerHeight;

    const generate = () => {
      const lw = getLogicalWidth();
      const lh = getLogicalHeight();
      while (particles.length < maxParticles) {
        particles.push(new Particle(lw, lh));
      }
    };

    const render = () => {
      const lw = getLogicalWidth();
      const lh = getLogicalHeight();
      if (particles.length < maxParticles - 5) generate();
      particles = particles.filter((p) => p.update(lw, lh));
      ctx.clearRect(0, 0, lw, lh);
      particles.forEach((p) => p.draw(ctx));
      animationFrameId = requestAnimationFrame(render);
    };

    updateCanvasSize();
    generate();
    render();

    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [darkMode]);

  return (
    <canvas
      ref={canvasRef}
      id="canvas-particles"
      className="fixed inset-0 pointer-events-none z-0 w-screen h-screen"
    />
  );
};
