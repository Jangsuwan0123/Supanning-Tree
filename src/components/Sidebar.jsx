import React from 'react';
import { BoxSelect, RotateCcw } from 'lucide-react';

export default function Sidebar({ 
  selectedSwitch, selectedLink, simType, simResult, 
  handlePropertyChange, handleLinkPropertyChange 
}) {
  return (
    <div className="w-80 flex flex-col bg-white border-l-2 border-gray-800 shrink-0 z-10">
      {/* 속성 패널 */}
      <div className="flex-1 border-b-2 border-gray-800 flex flex-col overflow-hidden max-h-[50%]">
        <div className="p-4 bg-slate-50 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <BoxSelect size={18} className="text-slate-600"/> 
            {selectedSwitch ? '스위치 속성' : selectedLink ? '선 연결 속성' : '속성'}
          </h2>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          {selectedSwitch ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Switch Name</label>
                <input
                  type="text"
                  value={selectedSwitch.name}
                  onChange={(e) => handlePropertyChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                <select
                  value={selectedSwitch.priority}
                  onChange={(e) => handlePropertyChange('priority', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {[0, 4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768, 36864, 40960, 45056, 49152, 53248, 57344, 61440].map(pri => (
                    <option key={pri} value={pri}>{pri} {pri === 32768 ? '(Default)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">MAC Address</label>
                <input
                  type="text"
                  value={selectedSwitch.mac}
                  onChange={(e) => handlePropertyChange('mac', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          ) : selectedLink ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost</label>
                <input
                  type="number"
                  min="1"
                  value={selectedLink.cost}
                  onChange={(e) => handleLinkPropertyChange('cost', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-2 text-xs text-gray-500">
                  일반적인 Cost 값 참고:<br/>- 10 Gbps: 2<br/>- 1 Gbps: 4<br/>- 100 Mbps (FastEthernet): 19<br/>- 10 Mbps (Ethernet): 100
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-center px-4">
              캔버스에서 스위치나 선을 선택하면<br/>속성을 편집할 수 있습니다.
            </div>
          )}
        </div>
      </div>

      {/* 로그 패널 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">{simType} 계산 결과</h2>
          {simResult && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">계산 완료</span>}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!simResult ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center px-4">
              <RotateCcw size={32} className="mb-3 text-gray-300" />
              <p>상단의 <strong>[{simType} 계산]</strong> 버튼을 누르면<br/>이곳에 결과가 나타납니다.</p>
            </div>
          ) : (
            simResult.logs.map((log, idx) => (
              <div key={idx} className="bg-white p-3 border border-gray-200 rounded-md shadow-sm">
                <h3 className={`font-bold text-xs mb-1 ${
                  log.type === 'root' ? 'text-yellow-600' : 
                  log.type === 'loop' ? 'text-red-600' : 
                  log.type === 'info' ? 'text-green-600' : 'text-blue-600'
                }`}>
                  {log.title}
                </h3>
                <p className="text-gray-600 text-xs leading-relaxed">{log.desc}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}