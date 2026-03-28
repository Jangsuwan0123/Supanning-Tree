import React from 'react';
import { Cpu, Crown } from 'lucide-react';

export default function Canvas({
  canvasRef, mode, switches, links, simResult,
  selectedSwitchId, selectedLinkId, connectingSourceId, mousePos,
  handleCanvasClick, handleMouseMove, handleMouseUp,
  handleLinkClick, handleSwitchMouseDown, handleSwitchClick
}) {
  return (
    <div 
      ref={canvasRef}
      className={`relative flex-1 bg-[#f8f9fa] overflow-hidden ${
        mode === 'create' ? 'cursor-crosshair' : 
        mode === 'delete' ? 'cursor-not-allowed' : 
        mode === 'connect' ? 'cursor-pointer' : 'cursor-default'
      }`}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {switches.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <p className="text-2xl font-bold text-gray-400">실습 환경 (Canvas)</p>
        </div>
      )}

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {links.map(link => {
          const source = switches.find(s => s.id === link.source);
          const target = switches.find(s => s.id === link.target);
          if (!source || !target) return null;
          
          const x1 = source.x + 32, y1 = source.y + 32;
          const x2 = target.x + 32, y2 = target.y + 32;
          const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
          
          const roles = simResult?.portRoles?.[link.id] || null;
          const sRole = roles?.[link.source];
          const tRole = roles?.[link.target];
          const isSelectedLink = selectedLinkId === link.id;

          return (
            <g key={link.id}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="20"
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => handleLinkClick(e, link.id)}
              />
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={(sRole === 'BLK' || tRole === 'BLK' || sRole === 'ALT' || tRole === 'ALT') ? '#fca5a5' : isSelectedLink ? '#3b82f6' : '#475569'}
                strokeWidth={isSelectedLink ? "5" : "3"}
                strokeDasharray={(sRole === 'BLK' || tRole === 'BLK' || sRole === 'ALT' || tRole === 'ALT') ? '4,4' : 'none'}
                className="transition-all duration-200 pointer-events-none"
              />
              <g transform={`translate(${midX}, ${midY - 12})`} className="pointer-events-none">
                <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="bold" fill={isSelectedLink ? "#2563eb" : "#64748b"} stroke="white" strokeWidth="3" paintOrder="stroke">
                  Cost: {link.cost}
                </text>
              </g>
              {sRole && (
                <g transform={`translate(${x1 + (x2 - x1) * 0.25}, ${y1 + (y2 - y1) * 0.25})`}>
                  <circle cx="0" cy="0" r="12" fill="white" stroke="#cbd5e1" strokeWidth="1" />
                  <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill={sRole === 'RP' ? '#16a34a' : sRole === 'DP' ? '#2563eb' : '#dc2626'}>{sRole}</text>
                </g>
              )}
              {tRole && (
                <g transform={`translate(${x1 + (x2 - x1) * 0.75}, ${y1 + (y2 - y1) * 0.75})`}>
                  <circle cx="0" cy="0" r="12" fill="white" stroke="#cbd5e1" strokeWidth="1" />
                  <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill={tRole === 'RP' ? '#16a34a' : tRole === 'DP' ? '#2563eb' : '#dc2626'}>{tRole}</text>
                </g>
              )}
            </g>
          );
        })}
        {mode === 'connect' && connectingSourceId && (
          <line
            x1={switches.find(s => s.id === connectingSourceId)?.x + 32 || 0}
            y1={switches.find(s => s.id === connectingSourceId)?.y + 32 || 0}
            x2={mousePos.x} y2={mousePos.y}
            stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,5"
          />
        )}
      </svg>

      {switches.map((sw) => {
        const isRoot = simResult?.rootBridgeId === sw.id;
        return (
          <div
            key={sw.id}
            className={`absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 ${mode === 'select' ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{ left: sw.x + 32, top: sw.y + 32 }}
            onMouseDown={(e) => handleSwitchMouseDown(e, sw.id)}
            onClick={(e) => handleSwitchClick(e, sw.id)}
          >
            {isRoot && (
              <div className="absolute -top-8 text-yellow-500 flex flex-col items-center animate-bounce">
                <Crown size={24} fill="currentColor" />
                <span className="text-[10px] font-black uppercase tracking-wider text-yellow-600 bg-yellow-100 px-1 rounded">Root</span>
              </div>
            )}
            <div className={`w-16 h-16 rounded-lg flex items-center justify-center shadow-lg transition-all relative
              ${selectedSwitchId === sw.id ? 'bg-blue-100 border-2 border-blue-500 shadow-blue-200 ring-4 ring-blue-50' : 'bg-white border-2 border-slate-700'}
              ${isRoot ? 'ring-4 ring-yellow-300 border-yellow-500' : ''}
              ${connectingSourceId === sw.id ? 'ring-4 ring-blue-300 border-blue-500 animate-pulse' : ''}
              ${mode === 'delete' ? 'hover:bg-red-100 hover:border-red-500' : ''}
              ${mode === 'connect' && connectingSourceId !== sw.id ? 'hover:bg-blue-50 hover:border-blue-400' : ''}
            `}>
              <Cpu size={32} className={selectedSwitchId === sw.id ? 'text-blue-600' : isRoot ? 'text-yellow-600' : 'text-slate-700'} />
            </div>
            <div className={`mt-2 px-2 py-0.5 rounded text-xs font-semibold shadow-md whitespace-nowrap ${isRoot ? 'bg-yellow-500 text-white' : 'bg-slate-800 text-white'}`}>
              {sw.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}