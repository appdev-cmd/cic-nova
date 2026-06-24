import React from 'react';

function DoorIllustration({ doorType, code, width = 120, height = 150, width1, height1, width2, height2 }) {
  // Normalize parameters
  const typeStr = (doorType || '').toUpperCase();
  const codeStr = (code || '').toUpperCase();

  const formatDim = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return num > 10 ? `${num} mm` : `${num} m`;
  };

  // Box size inside SVG viewbox (300 x 300)
  const pad = 20;
  const canvasW = 300;
  const canvasH = 300;
  const drawW = canvasW - 2 * pad;
  const drawH = canvasH - 2 * pad;

  // Let's decide which door to draw:
  // 1. Sliding Window with Fixed Panel (CSL-50.02, CSL-50.03 etc. or has 'LÙA' and 'CỐ ĐỊNH'/'FIX')
  const isSlidingWithFix = typeStr.includes('LÙA') && (codeStr.includes('50.02') || codeStr.includes('50.03') || typeStr.includes('CỐ ĐỊNH') || typeStr.includes('FIX'));
  
  // 2. Simple Sliding Window/Door (CSL-50.01 etc. or has 'LÙA')
  const isSliding = typeStr.includes('LÙA') && !isSlidingWithFix;

  // 3. Swing Door (CDMQ or has 'QUAY')
  const isSwing = typeStr.includes('QUAY') || typeStr.includes('CỬA ĐI MỞ');

  // Helper to draw glass gradient
  const renderGlassPattern = () => (
    <defs>
      <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.6" />
        <stop offset="40%" stopColor="#bae6fd" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="frameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
    </defs>
  );

  if (isSlidingWithFix) {
    // Cửa sổ lùa có ô fix (ví dụ CSL-50.02)
    const fixRatio = 0.35; // Top fix panel takes 35% height
    const fixH = drawH * fixRatio;
    const luateH = drawH * (1 - fixRatio);
    const topY = pad;
    const midY = pad + fixH;
    const botY = pad + drawH;
    const leftX = pad;
    const rightX = pad + drawW;
    const midX = pad + drawW / 2;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${canvasW} ${canvasH}`} style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {renderGlassPattern()}
        
        {/* Outer Frame */}
        <rect x={leftX} y={topY} width={drawW} height={drawH} fill="none" stroke="url(#frameGrad)" strokeWidth="6" rx="2" />
        
        {/* Top Fixed Panel Glass */}
        <rect x={leftX + 4} y={topY + 4} width={drawW - 8} height={fixH - 6} fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" />
        {/* Fixed Panel Glass reflections */}
        <line x1={leftX + 20} y1={topY + 15} x2={leftX + 50} y2={topY + 35} stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" />
        <line x1={leftX + 28} y1={topY + 15} x2={leftX + 38} y2={topY + 22} stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" />
        <text x={midX} y={topY + fixH/2 + 5} fill="#475569" fontSize="10" fontWeight="bold" textAnchor="middle">Ô FIX CỐ ĐỊNH</text>

        {/* Horizontal transom bar */}
        <line x1={leftX} y1={midY} x2={rightX} y2={midY} stroke="url(#frameGrad)" strokeWidth="6" />

        {/* Bottom Sliding Window (2 panels) */}
        {/* Left Panel (Rear) */}
        <rect x={leftX + 4} y={midY + 3} width={drawW/2 - 2} height={luateH - 7} fill="url(#glassGrad)" stroke="#475569" strokeWidth="3" />
        <line x1={leftX + 15} y1={midY + 20} x2={leftX + 35} y2={midY + 50} stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.6" />
        
        {/* Right Panel (Front) */}
        <rect x={midX - 2} y={midY + 3} width={drawW/2} height={luateH - 7} fill="url(#glassGrad)" stroke="url(#frameGrad)" strokeWidth="4" />
        <line x1={midX + 20} y1={midY + 20} x2={midX + 40} y2={midY + 50} stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.6" />

        {/* Handle on front panel */}
        <rect x={midX + 5} y={midY + luateH/2 - 10} width="3" height="20" fill="#94a3b8" rx="1" />

        {/* Sliding direction arrows */}
        <path d={`M ${leftX + drawW/4 - 15} ${midY + luateH - 20} L ${leftX + drawW/4 + 15} ${midY + luateH - 20}`} stroke="#475569" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <path d={`M ${midX + drawW/4 + 15} ${midY + luateH - 30} L ${midX + drawW/4 - 15} ${midY + luateH - 30}`} stroke="#475569" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Arrows Marker definition */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
        </defs>

        {/* Dimension Labels */}
        <text x={midX} y={canvasH - 4} fill="#64748b" fontSize="10" textAnchor="middle">W = {formatDim(width)}</text>
        <text x={4} y={canvasH/2} fill="#64748b" fontSize="10" textAnchor="middle" transform={`rotate(-90 4 ${canvasH/2})`}>H = {formatDim(height)}</text>
      </svg>
    );
  }

  if (isSliding) {
    // Cửa sổ/Cửa đi lùa đơn giản 2 cánh (ví dụ CSL-50.01)
    const leftX = pad;
    const rightX = pad + drawW;
    const midX = pad + drawW / 2;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${canvasW} ${canvasH}`} style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {renderGlassPattern()}
        
        {/* Outer Frame */}
        <rect x={leftX} y={pad} width={drawW} height={drawH} fill="none" stroke="url(#frameGrad)" strokeWidth="6" rx="2" />
        
        {/* Left Panel */}
        <rect x={leftX + 4} y={pad + 4} width={drawW/2 - 2} height={drawH - 8} fill="url(#glassGrad)" stroke="#475569" strokeWidth="3" />
        <line x1={leftX + 20} y1={pad + 40} x2={leftX + 60} y2={pad + 100} stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" />

        {/* Right Panel (overlap) */}
        <rect x={midX - 2} y={pad + 4} width={drawW/2} height={drawH - 8} fill="url(#glassGrad)" stroke="url(#frameGrad)" strokeWidth="4" />
        <line x1={midX + 20} y1={pad + 40} x2={midX + 60} y2={pad + 100} stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" />

        {/* Handle */}
        <rect x={midX + 5} y={pad + drawH/2 - 15} width="4" height="30" fill="#94a3b8" rx="1" />

        {/* Arrow direction */}
        <path d={`M ${leftX + drawW/4 - 20} ${pad + drawH - 30} L ${leftX + drawW/4 + 20} ${pad + drawH - 30}`} stroke="#475569" strokeWidth="2" markerEnd="url(#arrow)" />
        <path d={`M ${midX + drawW/4 + 20} ${pad + drawH - 50} L ${midX + drawW/4 - 20} ${pad + drawH - 50}`} stroke="#475569" strokeWidth="2" markerEnd="url(#arrow)" />
        
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
        </defs>

        {/* Dimension Labels */}
        <text x={midX} y={canvasH - 4} fill="#64748b" fontSize="10" textAnchor="middle">W = {formatDim(width)}</text>
        <text x={4} y={canvasH/2} fill="#64748b" fontSize="10" textAnchor="middle" transform={`rotate(-90 4 ${canvasH/2})`}>H = {formatDim(height)}</text>
      </svg>
    );
  }

  if (isSwing) {
    // Cửa đi mở quay (ví dụ CDMQ)
    const leftX = pad + 30; // Centered
    const rightX = pad + drawW - 30;
    const doorW = drawW - 60;
    const midX = pad + drawW / 2;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${canvasW} ${canvasH}`} style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {renderGlassPattern()}
        
        {/* Outer Frame (No bottom bar for swing door usually) */}
        <path d={`M ${leftX} ${pad + drawH} L ${leftX} ${pad} L ${rightX} ${pad} L ${rightX} ${pad + drawH}`} fill="none" stroke="url(#frameGrad)" strokeWidth="6" strokeLinecap="square" />

        {/* Door Panel */}
        <rect x={leftX + 4} y={pad + 3} width={doorW - 8} height={drawH - 6} fill="url(#glassGrad)" stroke="url(#frameGrad)" strokeWidth="4" />
        <line x1={leftX + 30} y1={pad + 50} x2={leftX + doorW - 30} y2={pad + 130} stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" />

        {/* Handle */}
        <rect x={rightX - 12} y={pad + drawH/2 - 15} width="4" height="25" fill="#e2e8f0" rx="1" stroke="#475569" strokeWidth="1" />
        <rect x={rightX - 18} y={pad + drawH/2 - 5} width="6" height="5" fill="#475569" />

        {/* Hinge marks (Left side) */}
        <rect x={leftX + 1} y={pad + 40} width="3" height="12" fill="#475569" />
        <rect x={leftX + 1} y={pad + drawH/2 - 6} width="3" height="12" fill="#475569" />
        <rect x={leftX + 1} y={pad + drawH - 60} width="3" height="12" fill="#475569" />

        {/* Swing dashed lines */}
        <path d={`M ${leftX + 5} ${pad + 4} L ${rightX - 5} ${pad + drawH/2} L ${leftX + 5} ${pad + drawH - 4}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,5" />

        {/* Dimension Labels */}
        <text x={midX} y={canvasH - 4} fill="#64748b" fontSize="10" textAnchor="middle">W = {formatDim(width)}</text>
        <text x={12} y={canvasH/2} fill="#64748b" fontSize="10" textAnchor="middle" transform={`rotate(-90 12 ${canvasH/2})`}>H = {formatDim(height)}</text>
      </svg>
    );
  }

  // Vách kính / Mặc định (Generic fixed partition/window)
  const leftX = pad;
  const rightX = pad + drawW;
  const midX = pad + drawW / 2;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${canvasW} ${canvasH}`} style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      {renderGlassPattern()}
      
      {/* Frame */}
      <rect x={leftX} y={pad} width={drawW} height={drawH} fill="url(#glassGrad)" stroke="url(#frameGrad)" strokeWidth="6" rx="2" />
      
      {/* Glazing lines */}
      <line x1={leftX + 20} y1={pad + 30} x2={leftX + 80} y2={pad + 100} stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.6" />
      <line x1={leftX + 32} y1={pad + 30} x2={leftX + 52} y2={pad + 53} stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.6" />

      {/* Label */}
      <text x={midX} y={canvasH/2 + 5} fill="#475569" fontSize="11" fontWeight="bold" textAnchor="middle">VÁCH KÍNH CỐ ĐỊNH</text>

      {/* Dimension Labels */}
      <text x={midX} y={canvasH - 4} fill="#64748b" fontSize="10" textAnchor="middle">W = {formatDim(width)}</text>
      <text x={4} y={canvasH/2} fill="#64748b" fontSize="10" textAnchor="middle" transform={`rotate(-90 4 ${canvasH/2})`}>H = {formatDim(height)}</text>
    </svg>
  );
}

export default DoorIllustration;
