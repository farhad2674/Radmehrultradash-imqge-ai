import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  type?: 'edge' | 'surface' | 'feature' | 'glow';
}

interface Particle {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  baseSize: number;
  color: string;
  alpha: number;
  glow: number;
  type: 'edge' | 'surface' | 'feature' | 'glow';
}

interface ApplianceModel {
  id: string;
  name: string;
  category: string;
  modelEngine: string;
  promptSnippet: string;
  status: string;
  colorTheme: string;
  secondaryColor: string;
  renderPoints: (count: number) => Point3D[];
}

// Helper functions for crisp geometric edge interpolation
const interpolateLine = (p1: [number, number, number], p2: [number, number, number], steps: number, type: 'edge' | 'feature' | 'glow' | 'surface' = 'edge'): Point3D[] => {
  const pts: Point3D[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      x: p1[0] + (p2[0] - p1[0]) * t,
      y: p1[1] + (p2[1] - p1[1]) * t,
      z: p1[2] + (p2[2] - p1[2]) * t,
      type,
    });
  }
  return pts;
};

const interpolateCircle = (center: [number, number, number], radius: number, steps: number, plane: 'xy' | 'xz' | 'yz' = 'xy', type: 'edge' | 'feature' | 'glow' | 'surface' = 'feature'): Point3D[] => {
  const pts: Point3D[] = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const c = Math.cos(theta) * radius;
    const s = Math.sin(theta) * radius;
    if (plane === 'xy') {
      pts.push({ x: center[0] + c, y: center[1] + s, z: center[2], type });
    } else if (plane === 'xz') {
      pts.push({ x: center[0] + c, y: center[1], z: center[2] + s, type });
    } else {
      pts.push({ x: center[0], y: center[1] + c, z: center[2] + s, type });
    }
  }
  return pts;
};

const interpolateRectangle = (center: [number, number, number], w: number, h: number, stepsPerSide: number, type: 'edge' | 'feature' | 'glow' | 'surface' = 'edge'): Point3D[] => {
  const x0 = center[0] - w / 2;
  const x1 = center[0] + w / 2;
  const y0 = center[1] - h / 2;
  const y1 = center[1] + h / 2;
  const z = center[2];
  return [
    ...interpolateLine([x0, y0, z], [x1, y0, z], stepsPerSide, type),
    ...interpolateLine([x1, y0, z], [x1, y1, z], stepsPerSide, type),
    ...interpolateLine([x1, y1, z], [x0, y1, z], stepsPerSide, type),
    ...interpolateLine([x0, y1, z], [x0, y0, z], stepsPerSide, type),
  ];
};

// 6 Highly recognizable 3D Smart Appliance Models with crisp structural outlines + dense surface lattices
const APPLIANCE_MODELS: ApplianceModel[] = [
  {
    id: 'refrigerator',
    name: 'Smart French-Door Refrigerator',
    category: 'Kitchen Appliance',
    modelEngine: 'nano-banana-2 • OpenRouter 8K',
    promptSnippet: 'Minimalist 4-door French refrigerator, tinted glass InstaView door, ice dispenser, brushed steel chassis',
    status: 'AI Latent Synthesis: 99.4%',
    colorTheme: '#38bdf8', // Cyan
    secondaryColor: '#93c5fd',
    renderPoints: (count) => {
      const pts: Point3D[] = [];
      const w = 130, h = 210, d = 100;
      const x0 = -w / 2, x1 = w / 2;
      const y0 = -h / 2, y1 = h / 2;
      const z0 = -d / 2, z1 = d / 2;

      // 1. Crisp 12 outer chassis bounding edges
      pts.push(...interpolateLine([x0, y0, z1], [x1, y0, z1], 35, 'edge'));
      pts.push(...interpolateLine([x1, y0, z1], [x1, y1, z1], 45, 'edge'));
      pts.push(...interpolateLine([x1, y1, z1], [x0, y1, z1], 35, 'edge'));
      pts.push(...interpolateLine([x0, y1, z1], [x0, y0, z1], 45, 'edge'));

      pts.push(...interpolateLine([x0, y0, z0], [x1, y0, z0], 30, 'edge'));
      pts.push(...interpolateLine([x1, y0, z0], [x1, y1, z0], 40, 'edge'));
      pts.push(...interpolateLine([x1, y1, z0], [x0, y1, z0], 30, 'edge'));
      pts.push(...interpolateLine([x0, y1, z0], [x0, y0, z0], 40, 'edge'));

      pts.push(...interpolateLine([x0, y0, z0], [x0, y0, z1], 25, 'edge'));
      pts.push(...interpolateLine([x1, y0, z0], [x1, y0, z1], 25, 'edge'));
      pts.push(...interpolateLine([x0, y1, z0], [x0, y1, z1], 25, 'edge'));
      pts.push(...interpolateLine([x1, y1, z0], [x1, y1, z1], 25, 'edge'));

      // 2. French Door Division: Vertical Center Seam for top doors
      const midY = 15; // horizontal split between top fridge and bottom freezer
      pts.push(...interpolateLine([0, y0, z1 + 1], [0, midY, z1 + 1], 40, 'feature'));

      // 3. Horizontal Freezer Drawer Dividers
      pts.push(...interpolateLine([x0, midY, z1 + 1], [x1, midY, z1 + 1], 35, 'feature'));
      const bottomDrawerY = midY + (y1 - midY) * 0.5;
      pts.push(...interpolateLine([x0, bottomDrawerY, z1 + 1], [x1, bottomDrawerY, z1 + 1], 35, 'feature'));

      // 4. Large Right Door InstaView Glass Window
      const winW = 42, winH = 75;
      const winCenterX = 30, winCenterY = y0 + 55;
      pts.push(...interpolateRectangle([winCenterX, winCenterY, z1 + 2], winW, winH, 18, 'feature'));

      // 5. Left Door Water & Ice Dispenser Nook
      const dispW = 32, dispH = 40;
      const dispCenterX = -32, dispCenterY = y0 + 60;
      pts.push(...interpolateRectangle([dispCenterX, dispCenterY, z1 + 2], dispW, dispH, 14, 'feature'));
      pts.push(...interpolateRectangle([dispCenterX, dispCenterY, z1 - 8], dispW - 6, dispH - 6, 10, 'feature'));

      // 6. Dual Vertical Tubular Door Handles
      pts.push(...interpolateLine([-8, y0 + 25, z1 + 14], [-8, midY - 15, z1 + 14], 30, 'feature'));
      pts.push(...interpolateLine([8, y0 + 25, z1 + 14], [8, midY - 15, z1 + 14], 30, 'feature'));
      // Stand-off mounts
      pts.push(...interpolateLine([-8, y0 + 25, z1 + 1], [-8, y0 + 25, z1 + 14], 8, 'feature'));
      pts.push(...interpolateLine([-8, midY - 15, z1 + 1], [-8, midY - 15, z1 + 14], 8, 'feature'));
      pts.push(...interpolateLine([8, y0 + 25, z1 + 1], [8, y0 + 25, z1 + 14], 8, 'feature'));
      pts.push(...interpolateLine([8, midY - 15, z1 + 1], [8, midY - 15, z1 + 14], 8, 'feature'));

      // 7. Horizontal Bottom Drawer Handles
      pts.push(...interpolateLine([-45, midY + 12, z1 + 12], [45, midY + 12, z1 + 12], 25, 'feature'));
      pts.push(...interpolateLine([-45, bottomDrawerY + 12, z1 + 12], [45, bottomDrawerY + 12, z1 + 12], 25, 'feature'));

      // 8. Uniform surface dot lattice for volume and solidity
      const remaining = Math.max(0, count - pts.length);
      for (let i = 0; i < remaining; i++) {
        const u = Math.random();
        if (u < 0.4) {
          // Front face panels
          pts.push({
            x: x0 + Math.random() * w,
            y: y0 + Math.random() * h,
            z: z1,
            type: 'surface',
          });
        } else if (u < 0.7) {
          // Side panels
          const isLeft = Math.random() > 0.5;
          pts.push({
            x: isLeft ? x0 : x1,
            y: y0 + Math.random() * h,
            z: z0 + Math.random() * d,
            type: 'surface',
          });
        } else {
          // Top & bottom caps
          const isTop = Math.random() > 0.5;
          pts.push({
            x: x0 + Math.random() * w,
            y: isTop ? y0 : y1,
            z: z0 + Math.random() * d,
            type: 'surface',
          });
        }
      }

      return pts;
    },
  },
  {
    id: 'washer',
    name: 'Smart Front-Load Drum Washer',
    category: 'Laundry Care',
    modelEngine: 'nano-banana-2 • OpenRouter 8K',
    promptSnippet: 'Matte obsidian front-load washer, glowing circular LED drum door, chrome bezel, touch dial',
    status: 'AI Latent Synthesis: 98.9%',
    colorTheme: '#818cf8', // Indigo
    secondaryColor: '#c7d2fe',
    renderPoints: (count) => {
      const pts: Point3D[] = [];
      const w = 150, h = 160, d = 130;
      const x0 = -w / 2, x1 = w / 2;
      const y0 = -h / 2, y1 = h / 2;
      const z0 = -d / 2, z1 = d / 2;

      // 1. Main outer cabinet frame
      pts.push(...interpolateLine([x0, y0, z1], [x1, y0, z1], 35, 'edge'));
      pts.push(...interpolateLine([x1, y0, z1], [x1, y1, z1], 35, 'edge'));
      pts.push(...interpolateLine([x1, y1, z1], [x0, y1, z1], 35, 'edge'));
      pts.push(...interpolateLine([x0, y1, z1], [x0, y0, z1], 35, 'edge'));

      pts.push(...interpolateLine([x0, y0, z0], [x1, y0, z0], 30, 'edge'));
      pts.push(...interpolateLine([x1, y0, z0], [x1, y1, z0], 30, 'edge'));
      pts.push(...interpolateLine([x1, y1, z0], [x0, y1, z0], 30, 'edge'));
      pts.push(...interpolateLine([x0, y0, z0], [x0, y1, z0], 30, 'edge'));

      pts.push(...interpolateLine([x0, y0, z0], [x0, y0, z1], 25, 'edge'));
      pts.push(...interpolateLine([x1, y0, z0], [x1, y0, z1], 25, 'edge'));
      pts.push(...interpolateLine([x0, y1, z0], [x0, y1, z1], 25, 'edge'));
      pts.push(...interpolateLine([x1, y1, z0], [x1, y1, z1], 25, 'edge'));

      // 2. Top Control Panel Divider
      const panelY = y0 + 36;
      pts.push(...interpolateLine([x0, panelY, z1 + 1], [x1, panelY, z1 + 1], 40, 'feature'));

      // 3. Top-Left Detergent Drawer
      pts.push(...interpolateRectangle([-48, y0 + 18, z1 + 2], 36, 22, 10, 'feature'));

      // 4. Top-Right Center Rotary Knob Dial & LED Matrix Display
      pts.push(...interpolateCircle([5, y0 + 18, z1 + 4], 12, 28, 'xy', 'feature'));
      pts.push(...interpolateCircle([5, y0 + 18, z1 + 8], 10, 24, 'xy', 'feature'));
      // Digital status display screen
      pts.push(...interpolateRectangle([46, y0 + 18, z1 + 2], 34, 18, 12, 'feature'));

      // 5. Large Signature Circular Front Glass Door (Triple concentric rings)
      const drumCenter: [number, number, number] = [0, 18, z1 + 2];
      pts.push(...interpolateCircle(drumCenter, 56, 70, 'xy', 'edge')); // Outer chrome bezel
      pts.push(...interpolateCircle(drumCenter, 48, 60, 'xy', 'feature')); // LED ring
      pts.push(...interpolateCircle(drumCenter, 38, 50, 'xy', 'feature')); // Inner glass hub
      pts.push(...interpolateCircle([drumCenter[0], drumCenter[1], z1 - 25], 36, 45, 'xy', 'feature')); // Recessed drum depth

      // Door latch handle arc on the right
      pts.push(...interpolateCircle([42, 18, z1 + 8], 12, 16, 'xy', 'feature'));

      // 6. Bottom Plinth / Filter Flap Door
      pts.push(...interpolateLine([x0, y1 - 18, z1 + 1], [x1, y1 - 18, z1 + 1], 35, 'feature'));
      pts.push(...interpolateRectangle([50, y1 - 9, z1 + 2], 20, 12, 8, 'feature'));

      // 7. Surface fill particles
      const remaining = Math.max(0, count - pts.length);
      for (let i = 0; i < remaining; i++) {
        const u = Math.random();
        if (u < 0.35) {
          // Front plate around circular door
          const fx = (Math.random() - 0.5) * (w - 10);
          const fy = (Math.random() - 0.5) * (h - 10);
          pts.push({ x: fx, y: fy, z: z1, type: 'surface' });
        } else if (u < 0.7) {
          // Inside drum spiral baffles
          const theta = Math.random() * Math.PI * 2;
          const r = Math.random() * 36;
          const drumZ = z1 - Math.random() * 40;
          pts.push({ x: Math.cos(theta) * r, y: 18 + Math.sin(theta) * r, z: drumZ, type: 'feature' });
        } else {
          // Cabinet sides
          const isLeft = Math.random() > 0.5;
          pts.push({
            x: isLeft ? x0 : x1,
            y: y0 + Math.random() * h,
            z: z0 + Math.random() * d,
            type: 'surface',
          });
        }
      }

      return pts;
    },
  },
  {
    id: 'air_conditioner',
    name: 'Smart Split Inverter AC Unit',
    category: 'Climate & Air Quality',
    modelEngine: 'sedance-2.5-pro • OpenRouter 8K',
    promptSnippet: 'Wall-mounted aerostream smart air conditioner, curved aerodynamic louvers, LED temperature display',
    status: 'AI Latent Synthesis: 99.7%',
    colorTheme: '#2dd4bf', // Teal
    secondaryColor: '#99f6e4',
    renderPoints: (count) => {
      const pts: Point3D[] = [];
      const w = 220, h = 80, d = 75;
      const x0 = -w / 2, x1 = w / 2;
      const y0 = -h / 2, y1 = h / 2;
      const z0 = -d / 2, z1 = d / 2;

      // 1. Curved aerodynamic front body profile
      const steps = 45;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t;
        // Top front edge
        pts.push({ x, y: y0, z: z1 - 10, type: 'edge' });
        // Middle front curve peak
        pts.push({ x, y: y0 + 25, z: z1 + 12, type: 'edge' });
        // Bottom front edge
        pts.push({ x, y: y1 - 12, z: z1 + 6, type: 'edge' });
        // Back top & bottom rails
        pts.push({ x, y: y0, z: z0, type: 'edge' });
        pts.push({ x, y: y1, z: z0, type: 'edge' });
      }

      // Left & Right side rounded endcaps
      pts.push(...interpolateLine([x0, y0, z0], [x0, y0, z1 - 10], 15, 'edge'));
      pts.push(...interpolateLine([x0, y0, z1 - 10], [x0, y0 + 25, z1 + 12], 15, 'edge'));
      pts.push(...interpolateLine([x0, y0 + 25, z1 + 12], [x0, y1 - 12, z1 + 6], 15, 'edge'));
      pts.push(...interpolateLine([x0, y1 - 12, z1 + 6], [x0, y1, z0], 15, 'edge'));
      pts.push(...interpolateLine([x0, y1, z0], [x0, y0, z0], 15, 'edge'));

      pts.push(...interpolateLine([x1, y0, z0], [x1, y0, z1 - 10], 15, 'edge'));
      pts.push(...interpolateLine([x1, y0, z1 - 10], [x1, y0 + 25, z1 + 12], 15, 'edge'));
      pts.push(...interpolateLine([x1, y0 + 25, z1 + 12], [x1, y1 - 12, z1 + 6], 15, 'edge'));
      pts.push(...interpolateLine([x1, y1 - 12, z1 + 6], [x1, y1, z0], 15, 'edge'));
      pts.push(...interpolateLine([x1, y1, z0], [x1, y0, z0], 15, 'edge'));

      // 2. Airflow Flap / Bottom Ventilation Louvers (Articulated vanes)
      for (let l = 0; l < 3; l++) {
        const louverY = y1 - 10 + l * 4;
        const louverZ = z1 + 8 + l * 3;
        pts.push(...interpolateLine([x0 + 15, louverY, louverZ], [x1 - 15, louverY, louverZ], 45, 'feature'));
      }

      // 3. Top Air Intake Grille Slits
      for (let g = 0; g < 6; g++) {
        const gx = -w * 0.4 + g * 32;
        pts.push(...interpolateLine([gx - 10, y0 - 2, z0 + 15], [gx + 10, y0 - 2, z1 - 15], 16, 'feature'));
      }

      // 4. Digital HUD LED Temperature Matrix Display ("72°F" icon area)
      const dispX = w * 0.28, dispY = 0;
      pts.push(...interpolateRectangle([dispX, dispY, z1 + 13], 32, 22, 14, 'feature'));
      pts.push(...interpolateCircle([dispX + 8, dispY - 5, z1 + 14], 3, 10, 'xy', 'glow')); // Degree symbol

      // 5. Surface lattice fill
      const remaining = Math.max(0, count - pts.length);
      for (let i = 0; i < remaining; i++) {
        const u = (Math.random() - 0.5) * (w - 10);
        const v = (Math.random() - 0.5) * (h - 10);
        const curve = Math.cos((v / h) * Math.PI) * 14;
        pts.push({
          x: u,
          y: v,
          z: (Math.random() > 0.4 ? z1 + curve : z0 + Math.random() * d),
          type: 'surface',
        });
      }

      return pts;
    },
  },
  {
    id: 'espresso_machine',
    name: 'Smart Barista Dual-Boiler Espresso Machine',
    category: 'Beverage Precision',
    modelEngine: 'nano-banana-2 • OpenRouter 8K',
    promptSnippet: 'Cast-aluminum dual-boiler espresso machine, circular pressure gauges, portafilter, steam wand, cup rail',
    status: 'AI Latent Synthesis: 99.1%',
    colorTheme: '#f59e0b', // Amber/Gold
    secondaryColor: '#fde68a',
    renderPoints: (count) => {
      const pts: Point3D[] = [];
      const w = 140, h = 160, d = 130;
      const x0 = -w / 2, x1 = w / 2;
      const y0 = -h / 2, y1 = h / 2;
      const z0 = -d / 2, z1 = d / 2;

      // 1. Main Cast Boiler Housing
      pts.push(...interpolateRectangle([0, y0 + 35, 0], w, 70, 20, 'edge'));
      pts.push(...interpolateRectangle([0, y0 + 35, z1], w, 70, 20, 'edge'));
      pts.push(...interpolateRectangle([0, y0 + 35, z0], w, 70, 20, 'edge'));

      // Vertical boiler corners
      pts.push(...interpolateLine([x0, y0, z1], [x0, 0, z1], 20, 'edge'));
      pts.push(...interpolateLine([x1, y0, z1], [x1, 0, z1], 20, 'edge'));
      pts.push(...interpolateLine([x0, y0, z0], [x0, y1, z0], 25, 'edge'));
      pts.push(...interpolateLine([x1, y0, z0], [x1, y1, z0], 25, 'edge'));

      // 2. Top Cup Warmer Railing (Polished chrome rail)
      const railH = y0 - 10;
      pts.push(...interpolateLine([x0 + 8, railH, z0 + 8], [x1 - 8, railH, z0 + 8], 25, 'feature'));
      pts.push(...interpolateLine([x1 - 8, railH, z0 + 8], [x1 - 8, railH, z1 - 8], 25, 'feature'));
      pts.push(...interpolateLine([x0 + 8, railH, z0 + 8], [x0 + 8, railH, z1 - 8], 25, 'feature'));
      // Rail corner posts
      pts.push(...interpolateLine([x0 + 8, y0, z0 + 8], [x0 + 8, railH, z0 + 8], 6, 'feature'));
      pts.push(...interpolateLine([x1 - 8, y0, z0 + 8], [x1 - 8, railH, z0 + 8], 6, 'feature'));
      pts.push(...interpolateLine([x0 + 8, y0, z1 - 8], [x0 + 8, railH, z1 - 8], 6, 'feature'));
      pts.push(...interpolateLine([x1 - 8, y0, z1 - 8], [x1 - 8, railH, z1 - 8], 6, 'feature'));

      // 3. Dual Front Pressure Gauges (Barometer circles)
      pts.push(...interpolateCircle([-32, y0 + 30, z1 + 2], 14, 28, 'xy', 'feature'));
      pts.push(...interpolateCircle([32, y0 + 30, z1 + 2], 14, 28, 'xy', 'feature'));
      // Gauge needles
      pts.push(...interpolateLine([-32, y0 + 30, z1 + 3], [-24, y0 + 22, z1 + 3], 6, 'glow'));
      pts.push(...interpolateLine([32, y0 + 30, z1 + 3], [40, y0 + 22, z1 + 3], 6, 'glow'));

      // 4. Center E61 Grouphead Collar
      const groupY = 5;
      pts.push(...interpolateCircle([0, groupY, z1 - 10], 22, 32, 'xz', 'feature'));
      pts.push(...interpolateCircle([0, groupY + 8, z1 - 10], 18, 28, 'xz', 'feature'));

      // 5. Portafilter Handle (Protruding outward forward with wooden handle)
      pts.push(...interpolateLine([0, groupY + 8, z1 - 10], [-4, groupY + 8, z1 + 55], 35, 'feature'));
      pts.push(...interpolateLine([0, groupY + 12, z1 - 10], [-4, groupY + 12, z1 + 55], 35, 'feature'));
      pts.push(...interpolateCircle([-4, groupY + 10, z1 + 55], 6, 12, 'xy', 'feature')); // Handle grip bulb

      // Dual spout below portafilter
      pts.push(...interpolateLine([-6, groupY + 12, z1 - 10], [-10, groupY + 24, z1 - 10], 10, 'feature'));
      pts.push(...interpolateLine([6, groupY + 12, z1 - 10], [10, groupY + 24, z1 - 10], 10, 'feature'));

      // 6. Right Side Steam Wand (Articulated angled pipe + nozzle)
      const wandBase: [number, number, number] = [w * 0.38, 0, z1];
      const wandJoint: [number, number, number] = [w * 0.42, 28, z1 + 18];
      const wandTip: [number, number, number] = [w * 0.32, 50, z1 + 24];
      pts.push(...interpolateLine(wandBase, wandJoint, 15, 'feature'));
      pts.push(...interpolateLine(wandJoint, wandTip, 15, 'feature'));
      pts.push(...interpolateCircle(wandTip, 4, 10, 'xy', 'glow'));

      // 7. Bottom Drip Tray & Sump Grill
      const trayY0 = y1 - 25, trayY1 = y1;
      pts.push(...interpolateRectangle([0, trayY1, 0], w + 10, d + 10, 25, 'edge'));
      pts.push(...interpolateRectangle([0, trayY0, z1 / 2], w, d, 25, 'edge'));
      // Drip tray front face
      pts.push(...interpolateRectangle([0, (trayY0 + trayY1) / 2, z1 + 5], w, 25, 20, 'edge'));

      // 8. Surface points
      const remaining = Math.max(0, count - pts.length);
      for (let i = 0; i < remaining; i++) {
        const u = Math.random();
        if (u < 0.4) {
          // Chassis body
          pts.push({
            x: (Math.random() - 0.5) * w,
            y: y0 + Math.random() * (h * 0.55),
            z: (Math.random() - 0.5) * d,
            type: 'surface',
          });
        } else {
          // Drip tray perforated grate
          pts.push({
            x: (Math.random() - 0.5) * (w - 15),
            y: trayY0 + 1,
            z: (Math.random() - 0.5) * (d - 15),
            type: 'surface',
          });
        }
      }

      return pts;
    },
  },
  {
    id: 'robot_vacuum',
    name: 'LiDAR Smart Autonomous Robot Vacuum',
    category: 'Automated Cleaning',
    modelEngine: 'sedance-2.5-pro • OpenRouter 8K',
    promptSnippet: 'Aerospace matte carbon robot vacuum, circular LiDAR laser turret, brushed gold rim bumper, camera window',
    status: 'AI Latent Synthesis: 99.5%',
    colorTheme: '#c084fc', // Purple/Violet
    secondaryColor: '#e9d5ff',
    renderPoints: (count) => {
      const pts: Point3D[] = [];
      const discRadius = 88;
      const discHeight = 36;
      const center: [number, number, number] = [0, 15, 0];

      // 1. Disc Chassis Cylindrical Rings (Top, Middle, Bottom)
      pts.push(...interpolateCircle([center[0], center[1] - discHeight / 2, center[2]], discRadius, 80, 'xz', 'edge'));
      pts.push(...interpolateCircle([center[0], center[1], center[2]], discRadius, 80, 'xz', 'edge'));
      pts.push(...interpolateCircle([center[0], center[1] + discHeight / 2, center[2]], discRadius, 80, 'xz', 'edge'));

      // 2. Front Spring-Loaded Bumper Arc with Optical Window
      for (let a = -Math.PI * 0.45; a <= Math.PI * 0.45; a += 0.08) {
        const bx = Math.sin(a) * (discRadius + 6);
        const bz = Math.cos(a) * (discRadius + 6);
        pts.push({ x: bx, y: center[1], z: bz, type: 'edge' });
        pts.push({ x: bx, y: center[1] - 8, z: bz, type: 'edge' });
      }

      // Optical Laser ToF Sensor Slit on front bumper
      pts.push(...interpolateLine([-25, center[1] - 4, discRadius + 7], [25, center[1] - 4, discRadius + 7], 20, 'glow'));

      // 3. Top Elevated LiDAR Laser Turret (Puck)
      const turretRadius = 26;
      const turretY = center[1] - discHeight / 2 - 14;
      pts.push(...interpolateCircle([0, turretY, -12], turretRadius, 45, 'xz', 'edge'));
      pts.push(...interpolateCircle([0, turretY + 8, -12], turretRadius, 45, 'xz', 'edge'));
      // Turret 360° laser slit
      pts.push(...interpolateCircle([0, turretY + 4, -12], turretRadius - 2, 35, 'xz', 'glow'));

      // 4. Top Face Controls (Home & Power buttons)
      pts.push(...interpolateCircle([0, center[1] - discHeight / 2, 35], 10, 20, 'xz', 'feature'));
      pts.push(...interpolateCircle([0, center[1] - discHeight / 2, 35], 4, 12, 'xz', 'glow'));

      // 5. Dustbin Release Seam Arc
      for (let a = Math.PI * 0.6; a <= Math.PI * 1.4; a += 0.1) {
        const sx = Math.sin(a) * (discRadius - 14);
        const sz = Math.cos(a) * (discRadius - 14);
        pts.push({ x: sx, y: center[1] - discHeight / 2, z: sz, type: 'feature' });
      }

      // 6. Dense Top Face Surface Spiral Lattice
      const remaining = Math.max(0, count - pts.length);
      for (let i = 0; i < remaining; i++) {
        const theta = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (discRadius - 4);
        const u = Math.random();
        if (u < 0.7) {
          // Top circular face
          pts.push({
            x: Math.cos(theta) * r,
            y: center[1] - discHeight / 2,
            z: Math.sin(theta) * r,
            type: 'surface',
          });
        } else {
          // Bottom chassis & side edge
          pts.push({
            x: Math.cos(theta) * discRadius,
            y: center[1] + (Math.random() - 0.5) * discHeight,
            z: Math.sin(theta) * discRadius,
            type: 'surface',
          });
        }
      }

      return pts;
    },
  },
  {
    id: 'smart_oven',
    name: 'Smart Built-In Convection Wall Oven',
    category: 'Culinary Hardware',
    modelEngine: 'nano-banana-2 • OpenRouter 8K',
    promptSnippet: 'Built-in seamless glass convection oven, transparent OLED door, interior glowing baking rack, touch display',
    status: 'AI Latent Synthesis: 99.8%',
    colorTheme: '#3b82f6', // Electric Blue
    secondaryColor: '#93c5fd',
    renderPoints: (count) => {
      const pts: Point3D[] = [];
      const w = 170, h = 150, d = 120;
      const x0 = -w / 2, x1 = w / 2;
      const y0 = -h / 2, y1 = h / 2;
      const z0 = -d / 2, z1 = d / 2;

      // 1. Outer Wall Cabinet Flange Trim
      pts.push(...interpolateRectangle([0, 0, z1], w, h, 35, 'edge'));
      pts.push(...interpolateRectangle([0, 0, z0], w - 10, h - 10, 25, 'edge'));
      pts.push(...interpolateLine([x0, y0, z0], [x0, y0, z1], 20, 'edge'));
      pts.push(...interpolateLine([x1, y0, z0], [x1, y0, z1], 20, 'edge'));
      pts.push(...interpolateLine([x0, y1, z0], [x0, y1, z1], 20, 'edge'));
      pts.push(...interpolateLine([x1, y1, z0], [x1, y1, z1], 20, 'edge'));

      // 2. Top Edge Touch Display Panel
      const panelHeight = 36;
      const panelBottomY = y0 + panelHeight;
      pts.push(...interpolateLine([x0 + 4, panelBottomY, z1 + 1], [x1 - 4, panelBottomY, z1 + 1], 40, 'edge'));
      // Center OLED Touch Screen
      pts.push(...interpolateRectangle([0, y0 + 18, z1 + 2], 70, 22, 18, 'feature'));
      pts.push(...interpolateCircle([-50, y0 + 18, z1 + 2], 9, 16, 'xy', 'feature')); // Mode dial
      pts.push(...interpolateCircle([50, y0 + 18, z1 + 2], 9, 16, 'xy', 'feature')); // Timer dial

      // 3. Large Panoramic Glass Oven Door
      const doorY0 = panelBottomY + 4;
      const doorY1 = y1 - 4;
      const doorCenterY = (doorY0 + doorY1) / 2;
      const doorH = doorY1 - doorY0;
      pts.push(...interpolateRectangle([0, doorCenterY, z1 + 2], w - 16, doorH, 35, 'feature'));

      // Glass viewing window inner bevel
      const winW = w - 46, winH = doorH - 28;
      pts.push(...interpolateRectangle([0, doorCenterY + 4, z1 + 3], winW, winH, 28, 'feature'));

      // 4. Heavy Stainless Steel Door Handle (Protruding outward)
      const handleY = doorY0 + 12;
      pts.push(...interpolateLine([x0 + 20, handleY, z1 + 18], [x1 - 20, handleY, z1 + 18], 40, 'feature'));
      // Handle corner standoffs
      pts.push(...interpolateLine([x0 + 20, handleY, z1 + 2], [x0 + 20, handleY, z1 + 18], 8, 'feature'));
      pts.push(...interpolateLine([x1 - 20, handleY, z1 + 2], [x1 - 20, handleY, z1 + 18], 8, 'feature'));

      // 5. Interior Illuminated Wire Baking Racks (Recessed in 3D cavity)
      for (let r = 0; r < 2; r++) {
        const rackY = doorCenterY - 6 + r * 28;
        const rackZ = z1 - 35;
        pts.push(...interpolateRectangle([0, rackY, rackZ], winW - 12, d - 30, 25, 'glow'));
        // Cross wire grids
        for (let wire = -winW * 0.35; wire <= winW * 0.35; wire += 16) {
          pts.push(...interpolateLine([wire, rackY, rackZ - (d - 30) / 2], [wire, rackY, rackZ + (d - 30) / 2], 12, 'glow'));
        }
      }

      // 6. Surface fill
      const remaining = Math.max(0, count - pts.length);
      for (let i = 0; i < remaining; i++) {
        const u = Math.random();
        if (u < 0.45) {
          // Front glass reflection
          pts.push({
            x: (Math.random() - 0.5) * (winW - 8),
            y: doorCenterY + (Math.random() - 0.5) * (winH - 8),
            z: z1 + 2,
            type: 'surface',
          });
        } else {
          // Outer oven body casing
          pts.push({
            x: (Math.random() - 0.5) * w,
            y: (Math.random() - 0.5) * h,
            z: z0 + Math.random() * d,
            type: 'surface',
          });
        }
      }

      return pts;
    },
  },
];

// Increased dot density to 1,200 nodes for ultra-crisp shape definition
const PARTICLE_COUNT = 1200;

export const ApplianceParticleMorphCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const particlesRef = useRef<Particle[]>([]);
  const rotationRef = useRef({ x: 0.22, y: -0.3 });
  const mouseRef = useRef({ x: 0, y: 0, isHovered: false });
  const animFrameIdRef = useRef<number | null>(null);

  const activeModel = APPLIANCE_MODELS[currentModelIndex];

  // Initialize particles
  useEffect(() => {
    const initialPoints = APPLIANCE_MODELS[0].renderPoints(PARTICLE_COUNT);
    const initialParticles: Particle[] = initialPoints.map((pt) => {
      const isEdge = pt.type === 'edge' || pt.type === 'feature';
      const isGlow = pt.type === 'glow';
      return {
        x: pt.x + (Math.random() - 0.5) * 120,
        y: pt.y + (Math.random() - 0.5) * 120,
        z: pt.z + (Math.random() - 0.5) * 120,
        targetX: pt.x,
        targetY: pt.y,
        targetZ: pt.z,
        vx: 0,
        vy: 0,
        vz: 0,
        size: isGlow ? 2.4 : isEdge ? 1.6 : 1.0,
        baseSize: isGlow ? 2.4 : isEdge ? 1.6 : 1.0,
        color: isGlow ? '#ffffff' : isEdge ? APPLIANCE_MODELS[0].colorTheme : APPLIANCE_MODELS[0].secondaryColor,
        alpha: isEdge ? 0.95 : 0.65,
        glow: isEdge ? 6 : 2,
        type: pt.type || 'surface',
      };
    });
    particlesRef.current = initialParticles;
  }, []);

  // Morph to specified model
  const morphToModel = (index: number) => {
    const nextIdx = (index + APPLIANCE_MODELS.length) % APPLIANCE_MODELS.length;
    setCurrentModelIndex(nextIdx);

    const targetPoints = APPLIANCE_MODELS[nextIdx].renderPoints(PARTICLE_COUNT);
    const model = APPLIANCE_MODELS[nextIdx];

    particlesRef.current.forEach((p, i) => {
      const target = targetPoints[i % targetPoints.length];
      p.targetX = target.x;
      p.targetY = target.y;
      p.targetZ = target.z;
      p.type = target.type || 'surface';

      const isEdge = target.type === 'edge' || target.type === 'feature';
      const isGlow = target.type === 'glow';

      p.baseSize = isGlow ? 2.4 : isEdge ? 1.6 : 1.0;
      p.color = isGlow ? '#ffffff' : isEdge ? model.colorTheme : model.secondaryColor;
      p.alpha = isEdge ? 0.95 : 0.65;

      // Controlled AI dispersion shockwave
      p.vx = (Math.random() - 0.5) * 7;
      p.vy = (Math.random() - 0.5) * 7;
      p.vz = (Math.random() - 0.5) * 7;
    });
  };

  // Auto-cycle timer every 5.2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentModelIndex((prev) => {
        const next = (prev + 1) % APPLIANCE_MODELS.length;
        const targetPoints = APPLIANCE_MODELS[next].renderPoints(PARTICLE_COUNT);
        const model = APPLIANCE_MODELS[next];

        particlesRef.current.forEach((p, i) => {
          const target = targetPoints[i % targetPoints.length];
          p.targetX = target.x;
          p.targetY = target.y;
          p.targetZ = target.z;
          p.type = target.type || 'surface';

          const isEdge = target.type === 'edge' || target.type === 'feature';
          const isGlow = target.type === 'glow';

          p.baseSize = isGlow ? 2.4 : isEdge ? 1.6 : 1.0;
          p.color = isGlow ? '#ffffff' : isEdge ? model.colorTheme : model.secondaryColor;
          p.alpha = isEdge ? 0.95 : 0.65;

          p.vx = (Math.random() - 0.5) * 5.5;
          p.vy = (Math.random() - 0.5) * 5.5;
          p.vz = (Math.random() - 0.5) * 5.5;
        });

        return next;
      });
    }, 5200);

    return () => clearInterval(interval);
  }, []);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 550);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth slow auto-rotation around Y axis
      if (!mouseRef.current.isHovered) {
        rotationRef.current.y += 0.007;
        rotationRef.current.x = 0.2 + Math.sin(Date.now() * 0.0008) * 0.06;
      }

      const cosY = Math.cos(rotationRef.current.y);
      const sinY = Math.sin(rotationRef.current.y);
      const cosX = Math.cos(rotationRef.current.x);
      const sinX = Math.sin(rotationRef.current.x);

      const fov = 420;
      const centerX = width / 2;
      const centerY = height / 2 - 10;

      const projectedParticles: {
        x: number;
        y: number;
        scale: number;
        alpha: number;
        color: string;
        size: number;
        z: number;
        type: string;
      }[] = [];

      // Update particle physics (Spring interpolation + damping)
      particlesRef.current.forEach((p) => {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dz = p.targetZ - p.z;

        // Snappy spring force for crisp alignment
        p.vx += dx * 0.055;
        p.vy += dy * 0.055;
        p.vz += dz * 0.055;

        // Damping
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.vz *= 0.82;

        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // 3D Rotation Transformations (Yaw + Pitch)
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.z * cosY + p.x * sinY;

        const y1 = p.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.y * sinX;

        // Perspective Projection
        const distance = fov + z2;
        if (distance > 10) {
          const scale = fov / distance;
          const projX = centerX + x1 * scale;
          const projY = centerY + y1 * scale;

          projectedParticles.push({
            x: projX,
            y: projY,
            scale,
            alpha: Math.min(1, Math.max(0.2, (z2 + 180) / 360)),
            color: p.color,
            size: p.baseSize * scale,
            z: z2,
            type: p.type,
          });
        }
      });

      // Sort particles by Z-depth (painter's algorithm)
      projectedParticles.sort((a, b) => a.z - b.z);

      // Draw subtle connective vector filaments along structural edge chains
      ctx.lineWidth = 0.8;
      const count = projectedParticles.length;
      for (let i = 0; i < count; i += 2) {
        const p1 = projectedParticles[i];
        if (p1.type !== 'edge' && p1.type !== 'feature') continue;

        for (let j = i + 1; j < Math.min(i + 7, count); j++) {
          const p2 = projectedParticles[j];
          if (p2.type !== 'edge' && p2.type !== 'feature') continue;

          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 28) {
            const lineAlpha = (1 - dist / 28) * 0.3 * p1.alpha;
            ctx.strokeStyle = p1.color;
            ctx.globalAlpha = lineAlpha;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw Luminous Particles
      projectedParticles.forEach((p) => {
        const isEdge = p.type === 'edge' || p.type === 'feature';
        const isGlow = p.type === 'glow';

        // Outer Radiant Bloom for edge/feature nodes
        if (isEdge || isGlow) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.8, p.size * 2.2), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * 0.28;
          ctx.fill();
        }

        // Crisp Core Dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.7, p.size), 0, Math.PI * 2);
        ctx.fillStyle = isGlow ? '#ffffff' : p.color;
        ctx.globalAlpha = isEdge ? p.alpha : p.alpha * 0.75;
        ctx.fill();

        // Hot center sparkle on key contour nodes
        if (isEdge && p.scale > 1.0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = p.alpha * 0.9;
          ctx.fill();
        }
      });

      // Subtle Cybernetic Scanline beam
      const scanY = (Date.now() * 0.07) % height;
      const grad = ctx.createLinearGradient(0, scanY - 24, 0, scanY + 24);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.05)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, scanY - 24, width, 48);

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, []);

  // Handle interactive mouse rotation
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    rotationRef.current.x = ny * 0.9;
    rotationRef.current.y = nx * 2.8;
    mouseRef.current.isHovered = true;
  };

  const handleMouseLeave = () => {
    mouseRef.current.isHovered = false;
  };

  return (
    <div
      className="relative w-full h-[540px] flex flex-col justify-between rounded-3xl bg-slate-950/70 border border-slate-800/90 backdrop-blur-2xl p-6 overflow-hidden select-none group shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient Lighting Aura */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[130px] pointer-events-none transition-colors duration-1000"
        style={{ backgroundColor: `${activeModel.colorTheme}18` }}
      />

      {/* Top HUD: AI Engine & Model Status */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg transition-colors duration-500"
            style={{
              backgroundColor: `${activeModel.colorTheme}20`,
              borderColor: `${activeModel.colorTheme}40`,
              color: activeModel.colorTheme,
            }}
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Latent Appliance Mesh
              </span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors duration-500"
                style={{
                  backgroundColor: `${activeModel.colorTheme}15`,
                  borderColor: `${activeModel.colorTheme}30`,
                  color: activeModel.colorTheme,
                }}
              >
                {activeModel.modelEngine}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">{activeModel.status}</p>
          </div>
        </div>
      </div>

      {/* Center High-Density Particle Canvas */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      </div>

      {/* Floating 3D Geometric Nodes Counter HUD */}
      <div className="absolute top-24 right-6 z-10 pointer-events-none hidden sm:flex flex-col items-end gap-1 text-[10px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5 font-bold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          1,200 STRUCTURAL NODES
        </span>
        <span className="text-slate-400">PRECISION 3D WIREFRAME MESH</span>
        <span className="text-slate-500">INTERACTIVE 360° DRAG ROTATION</span>
      </div>

      {/* Bottom HUD: Active Appliance Card & Switcher Controls */}
      <div className="relative z-10 space-y-3">
        
        {/* Active Appliance Title Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModel.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md shadow-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: activeModel.colorTheme }}
                />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {activeModel.name}
                </h3>
                <span className="text-[10px] font-mono text-slate-300 px-2 py-0.5 bg-slate-800 rounded">
                  {activeModel.category}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                Appliance #{currentModelIndex + 1}/6
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* 6 Appliance Interactive Dot Pills */}
        <div className="flex items-center justify-between gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80">
          {APPLIANCE_MODELS.map((model, idx) => {
            const isActive = idx === currentModelIndex;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => morphToModel(idx)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer relative ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
                style={{
                  backgroundColor: isActive ? `${model.colorTheme}30` : undefined,
                  borderColor: isActive ? `${model.colorTheme}60` : 'transparent',
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    isActive ? 'scale-125' : 'opacity-40'
                  }`}
                  style={{ backgroundColor: model.colorTheme }}
                />
                <span className="truncate text-[11px] font-medium hidden sm:inline">
                  {model.name.split(' ')[1] || model.name.split(' ')[0]}
                </span>
                <span className="sm:hidden text-[10px] font-mono">
                  0{idx + 1}
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};
