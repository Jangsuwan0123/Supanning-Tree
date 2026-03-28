import React from 'react';
import { Plus, Minus, Network, RotateCcw, ChevronDown } from 'lucide-react';

export default function Toolbar({ 
  simType, handleSimTypeChange, runFakeSimulation, 
  mode, setMode, handleReset, setConnectingSourceId, setSelectedSwitchId 
}) {
  const changeMode = (newMode) => {
    setMode(mode === newMode ? 'select' : newMode);
    setConnectingSourceId(null);
    setSelectedSwitchId(null);
  };

  const ToolbarButton = ({ currentMode, icon: Icon, label }) => (
    <button
      onClick={() => changeMode(currentMode)}
      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
        mode === currentMode 
          ? 'bg-blue-600 text-white shadow-inner' 
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b-2 border-gray-800 shrink-0 shadow-sm z-20">
      <div className="relative group">
        <div className="flex items-center gap-1 cursor-pointer py-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">{simType} Simulator</h1>
          <ChevronDown size={20} className="text-gray-500 group-hover:text-blue-600 transition-colors" />
        </div>
        <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
          {['STP', 'RSTP', 'MSTP'].map((type) => (
            <button
              key={type}
              onClick={() => handleSimTypeChange(type)}
              className={`block w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors ${
                simType === type ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700'
              }`}
            >
              {type} Simulator
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <button 
            onClick={runFakeSimulation}
            className="flex items-center gap-2 px-6 py-2 rounded-md font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <RotateCcw size={18} />
            {simType} 계산
          </button>
          <div className="w-px h-8 bg-gray-300 mx-2"></div>
          <ToolbarButton currentMode="create" icon={Plus} label="스위치 생성" />
          <ToolbarButton currentMode="delete" icon={Minus} label="스위치 제거" />
          <ToolbarButton currentMode="connect" icon={Network} label="선 연결" />
        </div>
        <div className="w-px h-6 bg-gray-200 mx-2"></div>
        <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md font-medium border border-transparent hover:border-red-200 transition-colors">
          초기화
        </button>
      </div>
    </header>
  );
}