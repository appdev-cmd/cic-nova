import React from 'react';

interface DoorIllustrationProps {
  doorType?: string;
  code?: string;
  width?: number | string;
  height?: number | string;
  width1?: number;
  height1?: number;
  width2?: number;
  height2?: number;
  layoutJson?: string | object;
  onPaneClick?: (nodeId: string) => void;
  selectedPaneId?: string;
}

const DoorIllustration: React.FC<DoorIllustrationProps> = ({ 
  doorType, 
  code, 
  width = 120, 
  height = 150, 
  width1, 
  height1, 
  width2, 
  height2,
  layoutJson,
  onPaneClick,
  selectedPaneId
}) => {
  // Normalize parameters
  const typeStr = (doorType || '').toUpperCase();
  const codeStr = (code || '').toUpperCase();

  const formatDim = (val: any) => {
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

  // Parse layoutJson if present
  let layoutObj: any = null;
  if (layoutJson) {
    try {
      layoutObj = typeof layoutJson === 'string' ? JSON.parse(layoutJson) : layoutJson;
    } catch (e) {
      console.error("Failed to parse layoutJson:", e);
    }
  }

  // Let's decide which door to draw:
  // 1. Sliding Window with Fixed Panel (CSL-50.02, CSL-50.03 etc. or has 'LÙA' and 'CỐ ĐỊNH'/'FIX')
  const isSlidingWithFix = 
    (typeStr.includes('LÙA') || codeStr.startsWith('CSL') || codeStr.startsWith('CDL') || typeStr.includes('SLIDING')) && 
    (codeStr.includes('50.02') || codeStr.includes('50.03') || typeStr.includes('CỐ ĐỊNH') || typeStr.includes('FIX') || codeStr.includes('FIX'));
  
  // 2. Simple Sliding Window/Door (CSL-50.01 etc. or has 'LÙA')
  const isSliding = 
    (typeStr.includes('LÙA') || codeStr.startsWith('CSL') || codeStr.startsWith('CDL') || typeStr.includes('SLIDING')) && 
    !isSlidingWithFix;

  // 3. Swing Door (CDMQ or has 'QUAY')
  const isSwing = 
    typeStr.includes('QUAY') || 
    typeStr.includes('CỬA ĐI MỞ') || 
    typeStr.includes('SWING') || 
    codeStr.includes('QUAY') || 
    codeStr.startsWith('CDMQ') || 
    codeStr.startsWith('CSMQ') || 
    codeStr.includes('MQ');

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

  // Helper to compute sub-dimension labels dynamically
  const getDimensionLabel = (parentDim: any, ratio: number, symbol: 'W' | 'H', index: number) => {
    // Check if there is an explicit override prop passed
    let overrideVal: number | undefined = undefined;
    if (symbol === 'H') {
      if (index === 1 && height1 !== undefined && height1 !== null) overrideVal = height1;
      else if (index === 2 && height2 !== undefined && height2 !== null) overrideVal = height2;
    } else if (symbol === 'W') {
      if (index === 1 && width1 !== undefined && width1 !== null) overrideVal = width1;
      else if (index === 2 && width2 !== undefined && width2 !== null) overrideVal = width2;
    }

    if (overrideVal !== undefined) {
      const displayVal = overrideVal > 10.0 ? `${overrideVal.toFixed(0)} mm` : `${overrideVal.toFixed(2)} m`;
      return `${symbol}${index} = ${displayVal}`;
    }

    if (parentDim === undefined || parentDim === null || parentDim === '') {
      return `${symbol}${index} = ${(ratio * 100).toFixed(0)}%`;
    }
    const num = parseFloat(parentDim);
    if (!isNaN(num) && isFinite(num)) {
      const val = num * ratio;
      const displayVal = val > 10.0 ? `${val.toFixed(0)} mm` : `${val.toFixed(2)} m`;
      return `${symbol}${index} = ${displayVal}`;
    }
    return `${symbol}${index} = ${(ratio * 100).toFixed(0)}%`;
  };

  // Asymmetrical paddings to give space for sub-dimensions in visual designer
  const padLeft = 28;
  const padRight = 52;
  const padTop = 30;
  const padBottom = 25;
  const layoutDrawW = canvasW - padLeft - padRight; // 220
  const layoutDrawH = canvasH - padTop - padBottom; // 245

  // Recursive renderer for custom layout tree
  const renderLayoutNode = (node: any, x: number, y: number, w: number, h: number): React.ReactNode => {
    if (!node) return null;
    
    const direction = node.direction || 'leaf';
    const children = node.children || [];
    
    if (direction === 'leaf') {
      const type = node.type || 'fixed';
      const label = node.label || '';
      const isSelected = selectedPaneId === node.id;
      
      return (
        <g key={node.id || Math.random().toString()}>
          {/* Glass pane with gradient */}
          <rect 
            x={x + 2} 
            y={y + 2} 
            width={w - 4} 
            height={h - 4} 
            fill="url(#glassGrad)" 
            stroke={isSelected ? '#f59e0b' : '#94a3b8'} 
            strokeWidth={isSelected ? '2.5' : '1'} 
            style={onPaneClick ? { cursor: 'pointer', transition: 'all 0.15s ease' } : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onPaneClick?.(node.id);
            }}
          />
          
          {/* Reflection lines */}
          <line 
            x1={x + 10} 
            y1={y + 10} 
            x2={x + Math.min(30, w - 10)} 
            y2={y + Math.min(30, h - 10)} 
            stroke="#ffffff" 
            strokeWidth="1.5" 
            strokeOpacity="0.5" 
          />
          
          {/* Specific panel overlays based on type */}
          {type === 'fixed' && label && (
            <text 
              x={x + w / 2} 
              y={y + h / 2 + 4} 
              fill="#475569" 
              fontSize="9" 
              fontWeight="bold" 
              textAnchor="middle"
            >
              {label}
            </text>
          )}
          
          {/* Sliding panel indicator */}
          {type === 'sliding-left' && (
            <path 
              d={`M ${x + w/2 + 15} ${y + h/2} L ${x + w/2 - 15} ${y + h/2}`} 
              stroke="#475569" 
              strokeWidth="1.5" 
              markerEnd="url(#arrow)" 
            />
          )}
          {type === 'sliding-right' && (
            <path 
              d={`M ${x + w/2 - 15} ${y + h/2} L ${x + w/2 + 15} ${y + h/2}`} 
              stroke="#475569" 
              strokeWidth="1.5" 
              markerEnd="url(#arrow)" 
            />
          )}
          
          {/* Swing door indicator */}
          {(type === 'swing-left' || type === 'swing') && (
            <path 
              d={`M ${x + 3} ${y + 3} L ${x + w - 3} ${y + h/2} L ${x + 3} ${y + h - 3}`} 
              fill="none" 
              stroke="#94a3b8" 
              strokeWidth="1.2" 
              strokeDasharray="4,4" 
            />
          )}
          {type === 'swing-right' && (
            <path 
              d={`M ${x + w - 3} ${y + 3} L ${x + 3} ${y + h/2} L ${x + w - 3} ${y + h - 3}`} 
              fill="none" 
              stroke="#94a3b8" 
              strokeWidth="1.2" 
              strokeDasharray="4,4" 
            />
          )}
          {type === 'awning' && (
            <path 
              d={`M ${x + 3} ${y + 3} L ${x + w/2} ${y + h - 3} L ${x + w - 3} ${y + 3}`} 
              fill="none" 
              stroke="#94a3b8" 
              strokeWidth="1.2" 
              strokeDasharray="4,4" 
            />
          )}
          
          {/* Handles */}
          {type.includes('sliding') && (
            <rect 
              x={type.includes('left') ? x + w - 7 : x + 4} 
              y={y + h/2 - 8} 
              width="3" 
              height="16" 
              fill="#94a3b8" 
              rx="1" 
            />
          )}
          {type.includes('swing') && (
            <rect 
              x={type.includes('left') ? x + w - 8 : x + 5} 
              y={y + h/2 - 10} 
              width="3" 
              height="20" 
              fill="#64748b" 
              rx="1" 
            />
          )}
        </g>
      );
    }
    
    const elements: React.ReactNode[] = [];
    let currentX = x;
    let currentY = y;
    
    const totalRatio = children.reduce((sum: number, child: any) => sum + (child.ratio || 0), 0) || 1;
    
    children.forEach((child: any, idx: number) => {
      const childRatio = (child.ratio || 0) / totalRatio;
      
      let childW = w;
      let childH = h;
      
      if (direction === 'horizontal') {
        childH = h * childRatio;
      } else if (direction === 'vertical') {
        childW = w * childRatio;
      }
      
      elements.push(renderLayoutNode(child, currentX, currentY, childW, childH));
      
      if (idx < children.length - 1) {
        if (direction === 'horizontal') {
          elements.push(
            <line 
              key={`h-bar-${idx}-${child.id}`} 
              x1={currentX} 
              y1={currentY + childH} 
              x2={currentX + w} 
              y2={currentY + childH} 
              stroke="url(#frameGrad)" 
              strokeWidth="4" 
            />
          );
        } else if (direction === 'vertical') {
          elements.push(
            <line 
              key={`v-bar-${idx}-${child.id}`} 
              x1={currentX + childW} 
              y1={currentY} 
              x2={currentX + childW} 
              y2={currentY + h} 
              stroke="url(#frameGrad)" 
              strokeWidth="4" 
            />
          );
        }
      }
      
      // Draw sub-dimension witness lines recursively
      if (direction === 'horizontal') {
        // Draw vertical height dimension on the right side of the entire door frame
        const rightEdge = padLeft + layoutDrawW;
        const dimX = rightEdge + 6;
        const labelText = getDimensionLabel(height, childRatio, 'H', idx + 1);
        
        elements.push(
          <g key={`h-dim-${idx}-${child.id}`} style={{ opacity: 0.85 }}>
            {/* Witness line */}
            <line x1={dimX} y1={currentY + 2} x2={dimX} y2={currentY + childH - 2} stroke="#475569" strokeWidth="0.8" />
            {/* End ticks */}
            <line x1={dimX - 2.5} y1={currentY + 2} x2={dimX + 2.5} y2={currentY + 2} stroke="#475569" strokeWidth="0.8" />
            <line x1={dimX - 2.5} y1={currentY + childH - 2} x2={dimX + 2.5} y2={currentY + childH - 2} stroke="#475569" strokeWidth="0.8" />
            {/* Text */}
            <text 
              x={dimX + 4} 
              y={currentY + childH / 2 + 2} 
              fill="#475569" 
              fontSize="6" 
              fontWeight="bold" 
              textAnchor="start"
            >
              {labelText}
            </text>
          </g>
        );
      } else if (direction === 'vertical') {
        // Draw horizontal width dimension at the very top of the entire door frame (outside the glass panes)
        const dimY = padTop - 8;
        const labelText = getDimensionLabel(width, childRatio, 'W', idx + 1);
        
        elements.push(
          <g key={`w-dim-${idx}-${child.id}`} style={{ opacity: 0.85 }}>
            {/* Witness line */}
            <line x1={currentX + 2} y1={dimY} x2={currentX + childW - 2} y2={dimY} stroke="#475569" strokeWidth="0.8" />
            {/* End ticks */}
            <line x1={currentX + 2} y1={dimY - 2.5} x2={currentX + 2} y2={dimY + 2.5} stroke="#475569" strokeWidth="0.8" />
            <line x1={currentX + childW - 2} y1={dimY - 2.5} x2={currentX + childW - 2} y2={dimY + 2.5} stroke="#475569" strokeWidth="0.8" />
            {/* Text */}
            <text 
              x={currentX + childW / 2} 
              y={dimY - 4} 
              fill="#475569" 
              fontSize="6" 
              fontWeight="bold" 
              textAnchor="middle"
            >
              {labelText}
            </text>
          </g>
        );
      }
      
      if (direction === 'horizontal') {
        currentY += childH;
      } else if (direction === 'vertical') {
        currentX += childW;
      }
    });
    
    return <g key={node.id || Math.random().toString()}>{elements}</g>;
  };

  // Render Layout Tree if present
  if (layoutObj) {
    const leftX = padLeft;
    const midX = padLeft + layoutDrawW / 2;
    const topY = padTop;
    
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${canvasW} ${canvasH}`} style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {renderGlassPattern()}
        
        {/* Outer Frame */}
        <rect x={leftX} y={topY} width={layoutDrawW} height={layoutDrawH} fill="none" stroke="url(#frameGrad)" strokeWidth="6" rx="2" />
        
        {/* Recursive Nodes */}
        {renderLayoutNode(layoutObj, leftX, topY, layoutDrawW, layoutDrawH)}
        
        {/* Arrows Marker definition */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
        </defs>

        {/* Dimension Labels */}
        <text x={midX} y={canvasH - 5} fill="#64748b" fontSize="10" textAnchor="middle">W = {formatDim(width)}</text>
        <text x={11} y={canvasH/2} fill="#64748b" fontSize="10" textAnchor="middle" transform={`rotate(-90 11 ${canvasH/2})`}>H = {formatDim(height)}</text>
      </svg>
    );
  }

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
        <text x={10} y={canvasH/2} fill="#64748b" fontSize="10" textAnchor="middle" transform={`rotate(-90 10 ${canvasH/2})`}>H = {formatDim(height)}</text>
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
        <text x={10} y={canvasH/2} fill="#64748b" fontSize="10" textAnchor="middle" transform={`rotate(-90 10 ${canvasH/2})`}>H = {formatDim(height)}</text>
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
      <text x={10} y={canvasH/2} fill="#64748b" fontSize="10" textAnchor="middle" transform={`rotate(-90 10 ${canvasH/2})`}>H = {formatDim(height)}</text>
    </svg>
  );
};

export default DoorIllustration;
