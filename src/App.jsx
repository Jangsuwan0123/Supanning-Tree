import React, { useState, useRef, useCallback, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';

const formatMacAddress = (num) => {
  const hexStr = num.toString(16).padStart(12, '0').toUpperCase();
  return hexStr.match(/.{1,2}/g).join(':');
};

export default function App() {
  const [simType, setSimType] = useState('STP');
  const [switches, setSwitches] = useState([]);
  const [links, setLinks] = useState([]);
  const [mode, setMode] = useState('select');
  const [selectedSwitchId, setSelectedSwitchId] = useState(null);
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [connectingSourceId, setConnectingSourceId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggedSwitchId, setDraggedSwitchId] = useState(null);

  const canvasRef = useRef(null);
  const macCounterRef = useRef(1);

  const selectedSwitch = switches.find(s => s.id === selectedSwitchId);
  const selectedLink = links.find(l => l.id === selectedLinkId);

  // [기존의 runFakeSimulation 전체 코드를 이 위치에 그대로 유지합니다]
  const runFakeSimulation = () => {
    // ... (작성하신 STP 다익스트라 계산 로직 동일하게 적용) ...
  };

  const handleCanvasClick = (e) => {
    if (mode === 'create') {
      const rect = canvasRef.current.getBoundingClientRect();
      const newSwitch = {
        id: Date.now().toString(),
        name: `Switch ${switches.length + 1}`,
        mac: formatMacAddress(macCounterRef.current++),
        priority: 32768,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setSwitches([...switches, newSwitch]);
      setSelectedSwitchId(newSwitch.id);
      setMode('select'); 
      setSimResult(null);
    } else if (mode === 'select' && !isDragging) {
      setSelectedSwitchId(null);
      setSelectedLinkId(null);
    } else if (mode !== 'select') {
      setMode('select');
      setConnectingSourceId(null);
    }
  };

  const handleLinkClick = (e, id) => {
    e.stopPropagation();
    if (mode === 'select') {
      setSelectedLinkId(id);
      setSelectedSwitchId(null);
    } else if (mode === 'delete') {
      setLinks(links.filter(l => l.id !== id));
      if (selectedLinkId === id) setSelectedLinkId(null);
      setSimResult(null);
    }
  };

  const handleSwitchMouseDown = (e, id) => {
    if (mode === 'select') {
      e.stopPropagation();
      const rect = canvasRef.current.getBoundingClientRect();
      const switchElement = switches.find(s => s.id === id);
      setIsDragging(true);
      setDraggedSwitchId(id);
      setSelectedSwitchId(id);
      setDragOffset({ x: e.clientX - rect.left - switchElement.x, y: e.clientY - rect.top - switchElement.y });
    }
  };

  const handleSwitchClick = (e, id) => {
    e.stopPropagation();
    if (mode === 'select') {
      if (!isDragging) { setSelectedSwitchId(id); setSelectedLinkId(null); }
    } else if (mode === 'delete') {
      setSwitches(switches.filter(s => s.id !== id));
      setLinks(links.filter(l => l.source !== id && l.target !== id));
      if (selectedSwitchId === id) setSelectedSwitchId(null);
      setSimResult(null);
    } else if (mode === 'connect') {
      if (!connectingSourceId) setConnectingSourceId(id);
      else {
        if (connectingSourceId !== id && !links.some(l => (l.source === connectingSourceId && l.target === id) || (l.source === id && l.target === connectingSourceId))) {
          setLinks([...links, { id: `${connectingSourceId}-${id}`, source: connectingSourceId, target: id, cost: 19 }]);
          setSimResult(null);
        }
        setConnectingSourceId(null);
        setMode('select');
      }
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    if (isDragging && draggedSwitchId) {
      setSwitches(prev => prev.map(sw => sw.id === draggedSwitchId ? { ...sw, x: x - dragOffset.x, y: y - dragOffset.y } : sw));
    }
  }, [isDragging, draggedSwitchId, dragOffset]);

  const handleMouseUp = () => { if (isDragging) { setIsDragging(false); setDraggedSwitchId(null); } };

  useEffect(() => {
    const handleGlobalMouseUp = () => { setIsDragging(false); setDraggedSwitchId(null); };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handlePropertyChange = (field, value) => {
    if (!selectedSwitchId) return;
    setSwitches(prev => prev.map(sw => sw.id === selectedSwitchId ? { ...sw, [field]: value } : sw));
    setSimResult(null);
  };

  const handleLinkPropertyChange = (field, value) => {
    if (!selectedLinkId) return;
    setLinks(prev => prev.map(l => l.id === selectedLinkId ? { ...l, [field]: value } : l));
    setSimResult(null);
  };

  const handleReset = () => {
    setSwitches([]); setLinks([]); setSelectedSwitchId(null); setSelectedLinkId(null);
    setConnectingSourceId(null); setMode('select'); setSimResult(null); macCounterRef.current = 1;
  };

  const handleSimTypeChange = (type) => { setSimType(type); handleReset(); };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-sm overflow-hidden select-none">
      <Toolbar 
        simType={simType} handleSimTypeChange={handleSimTypeChange} runFakeSimulation={runFakeSimulation}
        mode={mode} setMode={setMode} handleReset={handleReset}
        setConnectingSourceId={setConnectingSourceId} setSelectedSwitchId={setSelectedSwitchId}
      />
      <div className="flex flex-1 overflow-hidden">
        <Canvas 
          canvasRef={canvasRef} mode={mode} switches={switches} links={links} simResult={simResult}
          selectedSwitchId={selectedSwitchId} selectedLinkId={selectedLinkId} 
          connectingSourceId={connectingSourceId} mousePos={mousePos}
          handleCanvasClick={handleCanvasClick} handleMouseMove={handleMouseMove} handleMouseUp={handleMouseUp}
          handleLinkClick={handleLinkClick} handleSwitchMouseDown={handleSwitchMouseDown} handleSwitchClick={handleSwitchClick}
        />
        <Sidebar 
          selectedSwitch={selectedSwitch} selectedLink={selectedLink} simType={simType} simResult={simResult}
          handlePropertyChange={handlePropertyChange} handleLinkPropertyChange={handleLinkPropertyChange}
        />
      </div>
    </div>
  );
}