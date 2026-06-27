import React, { useRef, useEffect, useState } from 'react';
import cytoscape from 'cytoscape';
import { 
  Share2, 
  LayoutList,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  FileJson,
  X,
  ChevronRight,
  ChevronDown,
  Timer,
  Zap,
  Network,
  Save,
  FolderOpen,
  User,
  LogOut
} from 'lucide-react';

// =====================================================================
// 1. Types & Interfaces
// =====================================================================
interface SwitchData {
  id: string;
  name: string;
  priority: number;
  priorityMsti1?: number;
  priorityMsti2?: number;
  mac: string;
  bid?: string;
  costToRoot?: number;
}

interface RootBridgeData extends SwitchData {
  reason: string; 
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  sourceCost: number;
  targetCost: number;
  sourceRole?: string;
  targetRole?: string;
  _sourceName?: string; 
  _targetName?: string; 
}

interface STPResult {
  status: 'idle' | 'calculating' | 'error' | 'success'; 
  message: string;
  rootBridges: RootBridgeData[];
  logs: string[]; 
}

// =====================================================================
// 2. Helper Components (JSON Viewer)
// =====================================================================
const JsonTreeView = ({ data, level = 0 }: { data: any, level?: number }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isObject = data !== null && typeof data === 'object';

  if (!isObject) {
    return (
      <span className="text-blue-400 font-mono">
        {typeof data === 'string' ? `"${data}"` : String(data)}
      </span>
    );
  }

  return (
    <div className="font-mono text-[13px]">
      <div 
        className="flex items-center cursor-pointer hover:bg-white/5 py-0.5 rounded transition-colors group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500 mr-1" /> : <ChevronRight className="w-4 h-4 text-gray-500 mr-1" />}
        <span className="text-purple-400 font-bold group-hover:text-purple-300">
          {Array.isArray(data) ? `Array[${data.length}]` : "Object"}
        </span>
      </div>
      {isExpanded && (
        <div className="ml-5 border-l border-white/10 pl-3">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="py-0.5">
              <span className="text-gray-400 mr-2">{key}:</span>
              <JsonTreeView data={value} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// 3. Main App Component
// =====================================================================
export default function App() {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);
  const switchIdCounter = useRef<number>(1); 

  // --- 사용자 인증 및 DB 상태 ---
  const [currentUser, setCurrentUser] = useState<{ id: string, name: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<'login' | 'signup' | null>(null);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [savedTopologies, setSavedTopologies] = useState<{ id: number, name: string, data: any }[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);

  // 모드 상태 관리
  const [protocol, setProtocol] = useState<'STP' | 'RSTP' | 'MSTP'>('STP');
  const protocolRef = useRef<'STP' | 'RSTP' | 'MSTP'>('STP');
  const [activeMsti, setActiveMsti] = useState<0 | 1 | 2>(0);
  const activeMstiRef = useRef<0 | 1 | 2>(0);

  const [isConnectingMode, setIsConnectingMode] = useState(false);
  const isConnectingModeRef = useRef(false);
  const sourceNodeRef = useRef<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<SwitchData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);
  const [draftNode, setDraftNode] = useState<SwitchData | null>(null);
  const [draftEdge, setDraftEdge] = useState<EdgeData | null>(null);

  const [stpResult, setStpResult] = useState<STPResult>({
    status: 'idle', message: '', rootBridges: [], logs: []
  });

  const [packetModalData, setPacketModalData] = useState<any | null>(null);
  const tcActiveRef = useRef(false);
  const transitionTimerRef = useRef<any>(null); 
  const [transitionState, setTransitionState] = useState<{
    active: boolean; phase: 'Listening' | 'Learning' | 'Syncing' | 'Forwarding'; progress: number; timeLeft: number;
  }>({ active: false, phase: 'Forwarding', progress: 0, timeLeft: 0 });

  useEffect(() => {
    protocolRef.current = protocol;
    activeMstiRef.current = activeMsti;
    if (cyInstance.current && cyInstance.current.nodes().length > 0) {
      calculateSTP();
    }
  }, [protocol, activeMsti]);

  // Cytoscape Init
  useEffect(() => {
    if (!cyRef.current) return;

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements: [], 
      style: [
        {
          selector: 'node',
          style: {
            'label': (ele: any) => {
              const role = ele.data('roleName');
              const name = ele.data('name');
              return role ? `${role}\n(${name})` : name;
            },
            'text-wrap': 'wrap', 
            'background-color': '#ffffff',
            'border-width': 2,
            'border-color': '#00b07b',
            'width': 42,
            'height': 42,
            'text-valign': 'top', 
            'text-halign': 'center',
            'text-margin-y': -8, 
            'text-background-color': '#f8f9fa', 
            'text-background-opacity': 0.85,
            'text-background-padding': 4,
            'text-background-shape': 'roundrectangle',
            'font-size': '12px',
            'font-weight': 'bold',
            'color': '#333',
            'shadow-blur': 10,
            'shadow-color': '#000',
            'shadow-opacity': 0.1
          }
        },
        {
          selector: 'node:selected',
          style: { 'background-color': '#e6f7f2', 'border-color': '#009b6b', 'border-width': 4 }
        },
        {
          selector: 'node.root-bridge',
          style: { 'border-width': 4, 'border-color': '#8b5cf6', 'background-color': '#f3e8ff' }
        },
        {
          selector: 'node.bpdu-packet', 
          style: {
            'width': 12, 'height': 12, 'background-color': '#f59e0b',
            'border-width': 2, 'border-color': '#ffffff', 'events': 'no',
            'shadow-blur': 5, 'shadow-color': '#f59e0b'
          }
        },
        {
          selector: 'node.tcn-packet',
          style: {
            'width': 12, 'height': 12, 'background-color': '#ef4444',
            'border-width': 2, 'border-color': '#ffffff', 'events': 'no',
            'shadow-blur': 5, 'shadow-color': '#ef4444'
          }
        },
        {
          selector: 'node.tc-packet', 
          style: {
            'width': 12, 'height': 12, 'background-color': '#3b82f6',
            'border-width': 2, 'border-color': '#ffffff', 'events': 'no',
            'shadow-blur': 5, 'shadow-color': '#3b82f6'
          }
        },
        {
          selector: 'edge', 
          style: {
            'width': 3,
            'line-color': '#10b981', 
            'curve-style': 'bezier',
            'source-label': (ele: any) => {
              const r = ele.data('sourceRole');
              const c = ele.data('sourceCost') || 19;
              return r ? `${r}\n[Cost:${c}]` : `[Cost:${c}]`;
            },
            'target-label': (ele: any) => {
              const r = ele.data('targetRole');
              const c = ele.data('targetCost') || 19;
              return r ? `${r}\n[Cost:${c}]` : `[Cost:${c}]`;
            },
            'source-text-offset': 35,
            'target-text-offset': 35,
            'text-wrap': 'wrap',
            'font-size': 9,
            'font-weight': 'bold',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
            'text-background-padding': 2,
            'color': '#059669' 
          }
        },
        {
          selector: 'edge[sourceRole = "LIS"], edge[targetRole = "LIS"], edge[sourceRole = "LRN"], edge[targetRole = "LRN"], edge[sourceRole = "SYNC"], edge[targetRole = "SYNC"]',
          style: {
            'line-color': '#f59e0b', 
            'line-style': 'dashed',
            'color': '#d97706' 
          }
        },
        {
          selector: 'edge[?isBlocked]', 
          style: { 
            'line-style': 'dashed', 
            'line-color': '#fca5a5', 
            'color': '#ef4444' 
          }
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': '#3b82f6', 'width': 4 } 
        },
        {
          selector: '.source-node',
          style: { 'border-color': '#f59e0b', 'border-width': 4 }
        }
      ],
      layout: { name: 'preset' }
    });

    const cy = cyInstance.current;

    cy.on('select', 'node', (e) => {
      const data = e.target.data();
      setSelectedNode(data);
      setDraftNode(data); 
      setSelectedEdge(null);
      setDraftEdge(null);
    });

    cy.on('select', 'edge', (e) => {
      const data = e.target.data();
      const sName = cy.getElementById(data.source).data('name') || data.source;
      const tName = cy.getElementById(data.target).data('name') || data.target;
      const edgeData = { ...data, _sourceName: sName, _targetName: tName };
      setSelectedEdge(edgeData);
      setDraftEdge(edgeData); 
      setSelectedNode(null);
      setDraftNode(null);
    });

    cy.on('unselect', () => {
      setSelectedNode(null);
      setDraftNode(null);
      setSelectedEdge(null);
      setDraftEdge(null);
    });

    cy.on('tap', 'node', (e) => {
      if (!isConnectingModeRef.current) return;
      const nodeId = e.target.id();
      if (!sourceNodeRef.current) {
        sourceNodeRef.current = nodeId;
        e.target.addClass('source-node');
      } else {
        const src = sourceNodeRef.current;
        if (src !== nodeId) {
          const edgeId = `${src}-${nodeId}`;
          if (cy.getElementById(edgeId).empty()) {
            cy.add({
              group: 'edges',
              data: { id: edgeId, source: src, target: nodeId, sourceCost: 19, targetCost: 19 }
            });
            calculateSTP(); 
            sendTcnUpward([src, nodeId]);
          }
        }
        cy.getElementById(src).removeClass('source-node');
        sourceNodeRef.current = null;
      }
    });

    return () => cy.destroy();
  }, []);

  // Animation Loop
  useEffect(() => {
    let interval: any;
    if (stpResult.status === 'success' || stpResult.status === 'calculating') {
      interval = setInterval(() => {
        cyInstance.current?.edges().forEach(edge => {
          const d = edge.data();
          let sender = null, receiver = null;
          
          const srcRole = d.sourceRole === 'LIS' || d.sourceRole === 'LRN' || d.sourceRole === 'SYNC' ? d.targetSourceRole : d.sourceRole;
          const tgtRole = d.targetRole === 'LIS' || d.targetRole === 'LRN' || d.targetRole === 'SYNC' ? d.targetTargetRole : d.targetRole;

          if (srcRole === 'DP') { sender = d.source; receiver = d.target; }
          else if (tgtRole === 'DP') { sender = d.target; receiver = d.source; }

          if (sender && receiver) {
            const sNode = cyInstance.current?.getElementById(sender);
            const rNode = cyInstance.current?.getElementById(receiver);
            if (!sNode || !rNode || sNode.empty() || rNode.empty()) return;
            
            const packetClass = tcActiveRef.current ? 'tc-packet' : 'bpdu-packet';
            const pid = `p-${Date.now()}-${Math.random()}`;
            
            cyInstance.current?.add({ group: 'nodes', data: { id: pid }, classes: packetClass, position: { ...sNode.position() } });
            cyInstance.current?.getElementById(pid).animate({ position: { ...rNode.position() }, style: { opacity: 0 } }, { duration: 1500, complete: () => cyInstance.current?.remove(`#${pid}`) });
          }
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [stpResult]);

  const activateTC = () => {
    tcActiveRef.current = true;
    setTimeout(() => { tcActiveRef.current = false; }, 8000); 
  };

  const sendTcnUpward = (nodeIds: string[]) => {
    const cy = cyInstance.current;
    if (!cy) return;

    nodeIds.forEach(nodeId => {
        const node = cy.getElementById(nodeId);
        if (node.empty()) return;

        if (node.hasClass('root-bridge')) {
            activateTC();
            return;
        }

        let rpEdge: cytoscape.EdgeSingular | null = null;
        let neighborId: string | null = null;

        node.connectedEdges().forEach(edge => {
            if (edge.data('source') === nodeId && edge.data('targetSourceRole') === 'RP') { 
                rpEdge = edge; neighborId = edge.data('target');
            } else if (edge.data('target') === nodeId && edge.data('targetTargetRole') === 'RP') {
                rpEdge = edge; neighborId = edge.data('source');
            }
        });

        if (rpEdge && neighborId) {
            const neighborNode = cy.getElementById(neighborId);
            const pid = `tcn-${Date.now()}-${Math.random()}`;
            cy.add({ group: 'nodes', data: { id: pid }, classes: 'tcn-packet', position: { ...node.position() } });
            cy.getElementById(pid).animate({ position: { ...neighborNode.position() }, style: { opacity: 0 } }, {
                duration: 1000, complete: () => { cy.remove(`#${pid}`); sendTcnUpward([neighborId!]); }
            });
        }
    });
  };

  function resetSTPVisualization(skipStateUpdate = false) {
    const cy = cyInstance.current;
    clearInterval(transitionTimerRef.current);
    setTransitionState({ active: false, phase: 'Forwarding', progress: 0, timeLeft: 0 });
    
    if (!cy) return;
    cy.nodes().removeClass('root-bridge').data('roleName', null); 
    cy.edges().removeClass('blocked').data({ sourceRole: '', targetRole: '', isBlocked: false });
    if (!skipStateUpdate) {
      setStpResult({ status: 'idle', message: '', rootBridges: [], logs: [] });
    }
  }

  function calculateSTP() {
    const cy = cyInstance.current;
    if (!cy) return;
    const nodes = cy.nodes().map(n => n.data() as SwitchData);
    const edges = cy.edges().map(e => e.data() as EdgeData);
    const isRSTP = protocolRef.current === 'RSTP' || protocolRef.current === 'MSTP';

    if (nodes.length === 0) {
      resetSTPVisualization(true);
      setStpResult({ status: 'idle', message: '스위치를 생성하고 토폴로지를 구성하세요.', rootBridges: [], logs: [] });
      return;
    }

    const parent: Record<string, string> = {};
    nodes.forEach(n => parent[n.id] = n.id);
    const find = (i: string): string => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const union = (i: string, j: string) => {
      const rootI = find(i); const rootJ = find(j);
      if (rootI !== rootJ) { parent[rootI] = rootJ; return true; }
      return false; 
    };

    edges.forEach(e => { union(e.source, e.target); });

    if (edges.length === 0) {
      resetSTPVisualization(true);
      setStpResult({ status: 'idle', message: '선을 연결하여 토폴로지를 구성하세요.', rootBridges: [], logs: [] });
      return;
    }

    const componentsMap: Record<string, SwitchData[]> = {};
    nodes.forEach(n => {
      const root = find(n.id);
      if (!componentsMap[root]) componentsMap[root] = [];
      componentsMap[root].push(n);
    });

    const getActivePriority = (n: SwitchData) => {
        if (protocolRef.current === 'MSTP') {
            if (activeMstiRef.current === 1) return n.priorityMsti1 ?? 32768;
            if (activeMstiRef.current === 2) return n.priorityMsti2 ?? 32768;
        }
        return n.priority;
    };

    const getBID = (n: SwitchData) => getActivePriority(n).toString(16).padStart(4, '0') + n.mac.replace(/:/g, '').toLowerCase();
    
    const rootBridgesResult: RootBridgeData[] = [];
    const logsResult: string[] = [];

    resetSTPVisualization(true);

    Object.values(componentsMap).forEach(compNodes => {
      if (compNodes.length <= 1) return;

      compNodes.forEach(n => n.bid = getBID(n));
      compNodes.sort((a, b) => a.bid!.localeCompare(b.bid!));
      const rootBridge = compNodes[0];
      const activeRootPri = getActivePriority(rootBridge);
      
      let rootReason = '';
      if (compNodes.length > 1) {
        const runnerUp = compNodes[1];
        if (activeRootPri < getActivePriority(runnerUp)) {
          rootReason = `Priority 값(${activeRootPri})이 가장 낮아 우선 선출`;
        } else {
          rootReason = `Priority 동률, MAC 주소(${rootBridge.mac})가 더 낮아 선출`;
        }
      }

      rootBridgesResult.push({ ...rootBridge, reason: rootReason, name: protocolRef.current === 'MSTP' ? `CIST/Regional Root (MSTI ${activeMstiRef.current})` : 'Root-Switch' });

      cy.getElementById(rootBridge.id).addClass('root-bridge');
      cy.getElementById(rootBridge.id).data('roleName', protocolRef.current === 'MSTP' ? `Root (MSTI ${activeMstiRef.current})` : 'Root-Switch');
      cy.getElementById(rootBridge.id).data('costToRoot', 0);

      const costToRoot: Record<string, number> = {};
      compNodes.forEach(n => costToRoot[n.id] = Infinity);
      costToRoot[rootBridge.id] = 0;

      const queue = [rootBridge.id];
      while(queue.length > 0) {
        const curr = queue.shift()!;
        cy.getElementById(curr).connectedEdges().forEach(edge => {
          const edgeData = edge.data();
          const nxt = edgeData.source === curr ? edgeData.target : edgeData.source;
          const receivingPortCost = edgeData.source === curr ? (Number(edgeData.targetCost) || 19) : (Number(edgeData.sourceCost) || 19);
          
          if (costToRoot[curr] + receivingPortCost < costToRoot[nxt]) {
            costToRoot[nxt] = costToRoot[curr] + receivingPortCost;
            cy.getElementById(nxt).data('costToRoot', costToRoot[nxt]);
            if (!queue.includes(nxt)) queue.push(nxt);
          }
        });
      }

      const rootPorts: Record<string, string> = {}; 
      compNodes.forEach(n => {
        if (n.id === rootBridge.id) return;
        cy.getElementById(n.id).data('roleName', 'Non-Root-Switch');

        let bestEdge: string | null = null;
        let bestCost = Infinity;
        let bestSenderBid = 'ffffffffffffffff';

        cy.getElementById(n.id).connectedEdges().forEach(edge => {
          const edgeData = edge.data();
          const myPortCost = edgeData.source === n.id ? (Number(edgeData.sourceCost) || 19) : (Number(edgeData.targetCost) || 19);
          const neighborId = edgeData.source === n.id ? edgeData.target : edgeData.source;
          const neighbor = compNodes.find(x => x.id === neighborId);
          if (!neighbor) return;

          const costViaNeighbor = costToRoot[neighborId] + myPortCost;
          const senderBid = neighbor.bid!;

          if (costViaNeighbor < bestCost) {
            bestCost = costViaNeighbor; bestSenderBid = senderBid; bestEdge = edgeData.id;
          } else if (costViaNeighbor === bestCost && senderBid < bestSenderBid) {
             bestSenderBid = senderBid; bestEdge = edgeData.id;
          }
        });
        
        if (bestEdge) {
          rootPorts[n.id] = bestEdge;
          logsResult.push(`🔹 [RP 선정] ${n.id} 👉 Root 누적 비용(${bestCost}) 최저 (RP)`);
        }
      });

      const compNodeIds = compNodes.map(n => n.id);
      const compEdges = edges.filter(e => compNodeIds.includes(e.source) && compNodeIds.includes(e.target));

      compEdges.forEach(edge => {
        const src = compNodes.find(n => n.id === edge.source)!;
        const tgt = compNodes.find(n => n.id === edge.target)!;

        const bpduSrc = { cost: costToRoot[src.id], senderBid: src.bid! };
        const bpduTgt = { cost: costToRoot[tgt.id], senderBid: tgt.bid! };

        let designatedNodeId; let winReason = '';
        
        if (bpduSrc.cost < bpduTgt.cost) {
          designatedNodeId = src.id; winReason = `누적 비용 우위(${bpduSrc.cost} < ${bpduTgt.cost})`;
        } else if (bpduTgt.cost < bpduSrc.cost) {
          designatedNodeId = tgt.id; winReason = `누적 비용 우위(${bpduTgt.cost} < ${bpduSrc.cost})`;
        } else {
          designatedNodeId = bpduSrc.senderBid < bpduTgt.senderBid ? src.id : tgt.id; winReason = `비용 동일, Bridge ID 우위`;
        }

        let srcRole = ''; let tgtRole = '';
        const blockedRoleName = isRSTP ? 'ALT' : 'BLK';

        if (designatedNodeId === src.id) {
           srcRole = 'DP'; tgtRole = rootPorts[tgt.id] === edge.id ? 'RP' : blockedRoleName;
        } else {
           tgtRole = 'DP'; srcRole = rootPorts[src.id] === edge.id ? 'RP' : blockedRoleName;
        }

        if (srcRole === blockedRoleName || tgtRole === blockedRoleName) {
          const blkNodeId = srcRole === blockedRoleName ? src.id : tgt.id;
          const dpNodeId = srcRole === 'DP' ? src.id : tgt.id;
          logsResult.push(`🔸 [${blockedRoleName} 선정] ${src.id}↔${tgt.id} 구간 👉 ${winReason} 조건으로 ${dpNodeId}가 DP, 반대편 ${blkNodeId}측 차단(${blockedRoleName})`);
        }

        cy.getElementById(edge.id).data({
          targetSourceRole: srcRole, targetTargetRole: tgtRole,
          sourceRole: srcRole === blockedRoleName ? blockedRoleName : (isRSTP ? 'SYNC' : 'LIS'),
          targetRole: tgtRole === blockedRoleName ? blockedRoleName : (isRSTP ? 'SYNC' : 'LIS'),
          isBlocked: srcRole === blockedRoleName || tgtRole === blockedRoleName
        });

        if (srcRole === blockedRoleName || tgtRole === blockedRoleName) cy.getElementById(edge.id).addClass('blocked');
      });
    });

    clearInterval(transitionTimerRef.current);
    
    const TOTAL_STEPS = isRSTP ? 20 : 300; 
    const msg = isRSTP ? '고속 동기화 중 (약 2초)' : '포트 상태 전이 대기 중 (실제 30초 대기)';
      
    setTransitionState({ active: true, phase: isRSTP ? 'Syncing' : 'Listening', progress: 0, timeLeft: isRSTP ? 2 : 30 });
    const currentModeMsg = protocolRef.current === 'MSTP' ? `MSTI ${activeMstiRef.current} 계산 중... ` : '';
    setStpResult({ status: 'calculating', message: currentModeMsg + msg, rootBridges: rootBridgesResult, logs: logsResult });

    let step = 0;
    transitionTimerRef.current = setInterval(() => {
      step += 1; 
      const percentage = Math.floor((step / TOTAL_STEPS) * 100);
      const timeLeft = Math.ceil((TOTAL_STEPS - step) / 10);

      if (!isRSTP && step === 150) {
        setTransitionState(p => ({ ...p, phase: 'Learning', progress: percentage, timeLeft }));
        cyInstance.current?.edges().forEach(e => {
            const d = e.data();
            if (d.targetSourceRole && d.targetSourceRole !== 'BLK') e.data('sourceRole', 'LRN');
            if (d.targetTargetRole && d.targetTargetRole !== 'BLK') e.data('targetRole', 'LRN');
        });
      } else if (step >= TOTAL_STEPS) {
        clearInterval(transitionTimerRef.current);
        setTransitionState({ active: false, phase: 'Forwarding', progress: 100, timeLeft: 0 });
        
        cyInstance.current?.edges().forEach(e => {
            const d = e.data();
            if (d.targetSourceRole) e.data('sourceRole', d.targetSourceRole);
            if (d.targetTargetRole) e.data('targetRole', d.targetTargetRole);
        });

        setStpResult({
            status: 'success', message: `${protocolRef.current} 수렴 완료`, rootBridges: rootBridgesResult, logs: logsResult
        });
      } else {
        setTransitionState(p => ({ ...p, progress: percentage, timeLeft }));
      }
    }, 100);

    if (selectedNode) {
      const freshData = cy.getElementById(selectedNode.id).data() as SwitchData;
      setSelectedNode(freshData); setDraftNode(freshData);
    }
    if (selectedEdge) {
      const freshData = cy.getElementById(selectedEdge.id).data() as EdgeData;
      const sName = cy.getElementById(freshData.source).data('name') || freshData.source;
      const tName = cy.getElementById(freshData.target).data('name') || freshData.target;
      const edgeObj = { ...freshData, _sourceName: sName, _targetName: tName };
      setSelectedEdge(edgeObj); setDraftEdge(edgeObj);
    }
  }

  // --- UI Event Handlers ---
  const generateMac = (index: number) => {
    const hex = index.toString(16).padStart(2, '0').toUpperCase(); return `00:AA:BB:CC:DD:${hex}`;
  };

  const toggleConnectMode = () => {
    const newMode = !isConnectingMode;
    setIsConnectingMode(newMode); isConnectingModeRef.current = newMode;
    if (cyInstance.current) {
        cyInstance.current.autoungrabify(newMode);
        if (newMode) {
            cyInstance.current.$(':selected').unselect();
            setSelectedNode(null); setDraftNode(null); setSelectedEdge(null); setDraftEdge(null);
        } else if (sourceNodeRef.current) {
            cyInstance.current.getElementById(sourceNodeRef.current).removeClass('source-node');
            sourceNodeRef.current = null;
        }
    }
  };

  const handleRemoveSelectedNode = () => {
    if (!cyInstance.current || !selectedNode) return;
    const cy = cyInstance.current;
    const node = cy.getElementById(selectedNode.id);
    const neighbors = node.neighborhood('node').map(n => n.id()); 
    node.remove();
    setSelectedNode(null); setDraftNode(null);
    calculateSTP(); sendTcnUpward(neighbors); 
  };

  const handleRemoveSelectedEdge = () => {
    if (!cyInstance.current || !selectedEdge) return;
    const sources = [selectedEdge.source, selectedEdge.target]; 
    cyInstance.current.getElementById(selectedEdge.id).remove();
    setSelectedEdge(null); setDraftEdge(null);
    calculateSTP(); sendTcnUpward(sources); 
  };

  const handleDraftNodeChange = (field: keyof SwitchData, value: any) => { setDraftNode(prev => prev ? { ...prev, [field]: value } : null); };
  const handleDraftEdgeChange = (field: keyof EdgeData, value: any) => { setDraftEdge(prev => prev ? { ...prev, [field]: value } : null); };

  const applyNodeChanges = () => {
    if (!draftNode || !cyInstance.current) return;
    Object.keys(draftNode).forEach(key => cyInstance.current!.getElementById(draftNode.id).data(key, (draftNode as any)[key]));
    setSelectedNode(draftNode); calculateSTP(); sendTcnUpward([draftNode.id]); 
  };
  const cancelNodeChanges = () => { setDraftNode(selectedNode); };

  const applyEdgeChanges = () => {
    if (!draftEdge || !cyInstance.current) return;
    Object.keys(draftEdge).forEach(key => cyInstance.current!.getElementById(draftEdge.id).data(key, (draftEdge as any)[key]));
    setSelectedEdge(draftEdge); calculateSTP(); sendTcnUpward([draftEdge.source, draftEdge.target]);
  };
  const cancelEdgeChanges = () => { setDraftEdge(selectedEdge); };

  const handleViewPacket = () => {
    if (!selectedEdge || (stpResult.status !== 'success' && stpResult.status !== 'calculating') || !cyInstance.current) return;
    const root = stpResult.rootBridges[0];
    const isRSTP = protocol === 'RSTP';
    
    let senderId = selectedEdge.source;
    if (selectedEdge.targetRole === 'DP' || selectedEdge.targetRole === 'LIS' || selectedEdge.targetRole === 'LRN' || selectedEdge.targetRole === 'SYNC') senderId = selectedEdge.target;
    const senderData = cyInstance.current.getElementById(senderId).data() as SwitchData;
    const isTC = tcActiveRef.current;

    let protocolVersion = "Configuration (0x00)"; let bpduType = "0x00 (Config)"; let flags = isTC ? "0x01 (Topology Change)" : "0x00";

    if (protocol === 'RSTP') {
      protocolVersion = "Rapid Spanning Tree (0x02)"; bpduType = "0x02 (RSTP)"; flags = isTC ? "0x01 (Topology Change)" : "0x3C (Proposal/Agreement)";
    } else if (protocol === 'MSTP') {
      protocolVersion = "Multiple Spanning Tree (0x03)"; bpduType = "0x02 (RSTP/MSTP)"; flags = isTC ? "0x01 (Topology Change)" : "0x3C (Proposal/Agreement)";
    }

    const payload: any = {
      "Protocol Version": protocolVersion, "BPDU Type": bpduType, "BPDU Flags": flags,
      "CIST Root Identifier": `${root.priority} / ${root.mac}`, "CIST External Path Cost": senderData.costToRoot || 0,
      "CIST Regional Root Identifier": `${senderData.priority} / ${senderData.mac}`,
    };
    const packet = { "Layer 2: Ethernet": { "Destination MAC": "01:80:C2:00:00:00", "Protocol Type": "STP" }, "Layer 3: STP BPDU Payload": payload };
    setPacketModalData(packet);
  };

  // --- Mock DB Functions (나중에 Node.js + Oracle 서버로 fetch 연동할 부분) ---
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 백엔드(Oracle 연동 API)로 fetch 요청 전송 (예: POST /api/login)
    // 현재는 임시로 무조건 로그인 성공 처리
    setCurrentUser({ id: 'user123', name: authForm.username || '사용자' });
    setShowAuthModal(null);
    setAuthForm({ username: '', password: '' });
    alert(`${showAuthModal === 'login' ? '로그인' : '회원가입'} 성공!`);
  };

  const handleSaveTopology = () => {
    if (!currentUser) return alert('저장하려면 로그인이 필요합니다.');
    if (!cyInstance.current) return;
    
    // Cytoscape의 전체 그래프 데이터 추출 (JSON 형식)
    const topologyData = cyInstance.current.json();
    const topologyName = prompt('저장할 토폴로지 이름을 입력하세요:', `Topology ${new Date().toLocaleTimeString()}`);
    if (!topologyName) return;

    // TODO: 백엔드 API로 fetch 요청 전송 (예: POST /api/topologies)
    const newSave = { id: Date.now(), name: topologyName, data: topologyData };
    setSavedTopologies(prev => [...prev, newSave]);
    alert('DB에 토폴로지가 저장되었습니다! (Mock)');
  };

  const handleLoadTopology = (savedItem: any) => {
    if (!cyInstance.current) return;
    resetSTPVisualization();
    
    // 저장된 JSON 데이터로 Cytoscape 캔버스 덮어쓰기
    cyInstance.current.json(savedItem.data);
    
    // 로드 후 아이디 카운터 재조정 및 STP 재계산
    switchIdCounter.current = cyInstance.current.nodes().length + 1;
    calculateSTP();
    setShowLoadModal(false);
  };

  return (
    <div className="flex flex-col w-full h-screen bg-white text-gray-800 font-sans overflow-hidden">
      
      {/* 패킷 뷰어 모달 */}
      {packetModalData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[70%] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center text-blue-400 font-bold"><FileJson className="w-5 h-5 mr-2" /> Wireshark Packet Capture</div>
              <button onClick={() => setPacketModalData(null)} className="text-gray-500 hover:text-white"><X /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 custom-scrollbar"><JsonTreeView data={packetModalData} /></div>
          </div>
        </div>
      )}

      {/* 회원가입 / 로그인 모달 (Oracle 연동 예정 UI) */}
      {showAuthModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <h2 className="font-bold text-lg">{showAuthModal === 'login' ? '로그인' : '회원가입'} (Oracle DB 연동)</h2>
              <button onClick={() => setShowAuthModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">아이디</label>
                <input required type="text" className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="아이디 입력" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">비밀번호</label>
                <input required type="password" className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="비밀번호 입력" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors mt-2">
                {showAuthModal === 'login' ? '로그인 하기' : '회원가입 하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 토폴로지 불러오기 모달 */}
      {showLoadModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <h2 className="font-bold text-lg flex items-center"><FolderOpen className="w-5 h-5 mr-2 text-blue-600" /> 저장된 토폴로지 목록</h2>
              <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 max-h-[300px] overflow-auto">
              {savedTopologies.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">저장된 토폴로지가 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {savedTopologies.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer group" onClick={() => handleLoadTopology(t)}>
                      <span className="font-bold text-gray-700 group-hover:text-blue-700">{t.name}</span>
                      <span className="text-xs text-gray-400">Node: {t.data.elements?.nodes?.length || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 (DB 연동 버튼 추가됨) */}
      <header className="flex flex-col shrink-0 z-40 relative">
        <div className="flex items-center px-4 h-14 border-b border-gray-200 bg-white shadow-sm">
          <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mr-6">STP Simulator</h1>
          
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 mr-auto shadow-inner">
              <button onClick={() => setProtocol('STP')} className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${protocol === 'STP' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>802.1D (STP)</button>
              <button onClick={() => setProtocol('RSTP')} className={`px-3 py-1 text-sm font-bold rounded-md transition-all flex items-center ${protocol === 'RSTP' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Zap className="w-3.5 h-3.5 mr-1" /> 802.1w (RSTP)</button>
              <button onClick={() => setProtocol('MSTP')} className={`px-3 py-1 text-sm font-bold rounded-md transition-all flex items-center ${protocol === 'MSTP' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Network className="w-3.5 h-3.5 mr-1" /> 802.1s (MSTP)</button>
          </div>

          <div className="flex items-center space-x-3 mr-6 border-r pr-6 border-gray-200">
            {currentUser ? (
              <>
                <span className="text-sm font-bold text-gray-700 flex items-center"><User className="w-4 h-4 mr-1 text-blue-500" /> {currentUser.name}님</span>
                <button onClick={handleSaveTopology} className="flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors px-2 py-1"><Save className="w-4 h-4 mr-1" /> 저장</button>
                <button onClick={() => setShowLoadModal(true)} className="flex items-center text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1"><FolderOpen className="w-4 h-4 mr-1" /> 열기</button>
                <button onClick={() => setCurrentUser(null)} className="flex items-center text-xs text-gray-400 hover:text-gray-600 px-2"><LogOut className="w-3.5 h-3.5 mr-1" /> 로그아웃</button>
              </>
            ) : (
              <>
                <button onClick={() => setShowAuthModal('login')} className="text-sm font-bold text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5">로그인</button>
                <button onClick={() => setShowAuthModal('signup')} className="text-sm font-bold text-white bg-gray-800 hover:bg-black rounded-lg px-4 py-1.5 transition-colors">회원가입</button>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => {
              const cy = cyInstance.current; if (!cy) return; const id = `SW${switchIdCounter.current++}`;
              cy.add({ group: 'nodes', data: { id, name: id, priority: 32768, priorityMsti1: 32768, priorityMsti2: 32768, mac: generateMac(switchIdCounter.current) }, position: { x: cy.width()/2 + (Math.random()-0.5)*100, y: cy.height()/2 + (Math.random()-0.5)*100 } });
              calculateSTP(); 
            }} className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors font-bold text-gray-700">스위치 생성</button>
            <button onClick={toggleConnectMode} className={`px-3 py-1.5 border rounded text-sm transition-all ${isConnectingMode ? 'bg-blue-100 border-blue-300 text-blue-700 font-bold shadow-inner' : 'bg-white border-gray-300 font-bold text-gray-700'}`}>
              <Share2 className="w-4 h-4 mr-1 inline" /> {isConnectingMode ? '연결 모드 종료' : '선 연결'}
            </button>
            <button onClick={() => { resetSTPVisualization(); cyInstance.current?.elements().remove(); switchIdCounter.current = 1; }} className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded text-sm font-bold transition-colors">초기화</button>
          </div>
        </div>

        {protocol === 'MSTP' && (
          <div className="flex items-center justify-center bg-teal-50 border-b border-teal-100 h-10 space-x-4 shadow-inner">
            <span className="text-[11px] text-teal-700 font-bold mr-2"><Network className="w-3 h-3 inline mr-1" /> Active View:</span>
            <button onClick={() => setActiveMsti(0)} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${activeMsti === 0 ? 'bg-teal-600 text-white shadow-sm' : 'text-teal-600 hover:bg-teal-100'}`}>MSTI 0 (Default / VLAN 1)</button>
            <button onClick={() => setActiveMsti(1)} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${activeMsti === 1 ? 'bg-teal-600 text-white shadow-sm' : 'text-teal-600 hover:bg-teal-100'}`}>MSTI 1 (VLAN 10-20)</button>
            <button onClick={() => setActiveMsti(2)} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${activeMsti === 2 ? 'bg-teal-600 text-white shadow-sm' : 'text-teal-600 hover:bg-teal-100'}`}>MSTI 2 (VLAN 30-40)</button>
          </div>
        )}
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
          <span className="text-[120px] font-black tracking-widest leading-none">SIMULATION</span>
          <span className="text-[80px] font-bold tracking-widest leading-none">CANVAS</span>
        </div>

        <div className="relative flex-1 bg-[#f8f9fa] z-10">
          <div ref={cyRef} className="absolute inset-0 w-full h-full" />
          {!cyInstance.current?.nodes().length && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-gray-400 font-bold text-xl bg-white/80 px-6 py-3 rounded-2xl shadow-sm backdrop-blur-sm border border-gray-200">
                    스위치를 생성하고 토폴로지를 구성하세요
                  </p>
              </div>
          )}
        </div>

        <aside className="w-[340px] bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-auto z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.03)] relative">
          <div className="p-4 border-b bg-gray-50 font-bold text-sm flex items-center tracking-tight">
            <LayoutList className="w-4 h-4 mr-2 text-gray-400" /> 속성 및 제어
          </div>
          <div className="p-4 flex-1">
            {draftNode && selectedNode ? (
              (() => {
                const isValidMac = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(draftNode.mac);
                const isValidPriority = draftNode.priority >= 0 && draftNode.priority <= 65535;
                const isNodeChanged = 
                  draftNode.name !== selectedNode.name || 
                  draftNode.priority !== selectedNode.priority || 
                  draftNode.priorityMsti1 !== selectedNode.priorityMsti1 ||
                  draftNode.priorityMsti2 !== selectedNode.priorityMsti2 ||
                  draftNode.mac !== selectedNode.mac;

                return (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">노드 구성</div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">스위치 이름</label>
                        <input className="w-full border p-2 rounded text-sm bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all" value={draftNode.name} onChange={(e) => handleDraftNodeChange('name', e.target.value)} />
                    </div>
                    
                    {protocol === 'MSTP' ? (
                      <div className="bg-teal-50 p-3 rounded-lg border border-teal-100 space-y-2">
                        <div className="text-[10px] font-bold text-teal-700 uppercase tracking-widest mb-2">MSTP Priorities</div>
                        <div>
                            <label className={`text-xs block mb-1 font-bold ${activeMsti === 0 ? 'text-teal-600' : 'text-gray-500'}`}>Priority (MSTI 0)</label>
                            <input type="number" min="0" max="65535" step="4096" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-teal-200" value={draftNode.priority} onChange={(e) => handleDraftNodeChange('priority', parseInt(e.target.value))} />
                        </div>
                        <div>
                            <label className={`text-xs block mb-1 font-bold ${activeMsti === 1 ? 'text-teal-600' : 'text-gray-500'}`}>Priority (MSTI 1)</label>
                            <input type="number" min="0" max="65535" step="4096" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-teal-200" value={draftNode.priorityMsti1 || 32768} onChange={(e) => handleDraftNodeChange('priorityMsti1', parseInt(e.target.value))} />
                        </div>
                        <div>
                            <label className={`text-xs block mb-1 font-bold ${activeMsti === 2 ? 'text-teal-600' : 'text-gray-500'}`}>Priority (MSTI 2)</label>
                            <input type="number" min="0" max="65535" step="4096" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-teal-200" value={draftNode.priorityMsti2 || 32768} onChange={(e) => handleDraftNodeChange('priorityMsti2', parseInt(e.target.value))} />
                        </div>
                      </div>
                    ) : (
                      <div>
                          <label className="text-xs text-gray-500 block mb-1">Priority (STP/RSTP)</label>
                          <input type="number" min="0" max="65535" step="4096" className={`w-full border p-2 rounded text-sm outline-none transition-all ${!isValidPriority ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'focus:ring-2 focus:ring-blue-100'}`} value={draftNode.priority} onChange={(e) => handleDraftNodeChange('priority', e.target.value === '' ? 0 : parseInt(e.target.value))} />
                      </div>
                    )}

                    <div>
                        <label className="text-xs text-gray-500 block mb-1">MAC Address</label>
                        <input className={`w-full border p-2 rounded text-sm font-mono outline-none transition-all ${!isValidMac ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'focus:ring-2 focus:ring-blue-100'}`} value={draftNode.mac} onChange={(e) => handleDraftNodeChange('mac', e.target.value)} />
                    </div>

                    {isNodeChanged && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg animate-in fade-in zoom-in duration-200 shadow-sm">
                        <p className="text-xs text-amber-700 font-bold mb-3 flex items-center"><AlertTriangle className="w-4 h-4 mr-1.5" />변경 사항을 적용하시겠습니까?</p>
                        <div className="flex space-x-2">
                          <button onClick={applyNodeChanges} disabled={!isValidMac || !isValidPriority} className={`flex-1 text-white text-[11px] font-bold py-1.5 rounded transition-colors shadow-sm ${(!isValidMac || !isValidPriority) ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}>적용</button>
                          <button onClick={cancelNodeChanges} className="flex-1 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 text-[11px] font-bold py-1.5 rounded transition-colors">취소</button>
                        </div>
                      </div>
                    )}

                    <button onClick={handleRemoveSelectedNode} className="w-full py-2 bg-red-50 text-red-600 rounded text-sm font-bold border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center mt-2">
                        <Trash2 className="w-4 h-4 mr-2" /> 스위치 삭제
                    </button>
                  </div>
                );
              })()
            ) : draftEdge && selectedEdge ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">연결 구성</div>
                <div className="text-xs font-mono bg-blue-50 text-blue-700 p-3 rounded border border-blue-100 text-center">
                    {draftEdge._sourceName || draftEdge.source} <br/> ↔ <br/> {draftEdge._targetName || draftEdge.target}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-gray-500 mb-1 block truncate">Cost ({draftEdge._sourceName || draftEdge.source})</label>
                        <input type="number" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" value={draftEdge.sourceCost} onChange={(e) => handleDraftEdgeChange('sourceCost', parseInt(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 mb-1 block truncate">Cost ({draftEdge._targetName || draftEdge.target})</label>
                        <input type="number" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" value={draftEdge.targetCost} onChange={(e) => handleDraftEdgeChange('targetCost', parseInt(e.target.value))} />
                    </div>
                </div>

                {(draftEdge.sourceCost !== selectedEdge.sourceCost || draftEdge.targetCost !== selectedEdge.targetCost) && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg animate-in fade-in zoom-in duration-200 shadow-sm">
                    <p className="text-xs text-amber-700 font-bold mb-3 flex items-center"><AlertTriangle className="w-4 h-4 mr-1.5" />비용을 업데이트 하시겠습니까?</p>
                    <div className="flex space-x-2">
                      <button onClick={applyEdgeChanges} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold py-1.5 rounded transition-colors shadow-sm">적용</button>
                      <button onClick={cancelEdgeChanges} className="flex-1 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 text-[11px] font-bold py-1.5 rounded transition-colors">취소</button>
                    </div>
                  </div>
                )}

                {(stpResult.status === 'success' || stpResult.status === 'calculating') && (
                  <button onClick={handleViewPacket} className="w-full py-2.5 bg-blue-600 text-white rounded text-sm font-bold shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all transform active:scale-95 mt-2">
                    <FileJson className="w-4 h-4 mr-2" /> BPDU 패킷 분석 (Wireshark)
                  </button>
                )}
                <button onClick={handleRemoveSelectedEdge} className="w-full py-2 bg-red-50 text-red-600 rounded text-sm font-bold border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center mt-2">
                    <Trash2 className="w-4 h-4 mr-2" /> 선 제거
                </button>
              </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4 opacity-50">
                    <div className="p-4 bg-gray-100 rounded-full"><LayoutList className="w-8 h-8 text-gray-400" /></div>
                    <p className="text-sm text-gray-500 break-keep leading-relaxed font-bold">캔버스에서 스위치나 선을 선택하여<br/>세부 속성을 편집하거나 패킷을 분석하세요.</p>
                </div>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50 font-bold text-sm">STP 계산 결과</div>
          <div className="p-4 min-h-[250px] overflow-auto border-t border-gray-100 relative">
            {stpResult.status === 'calculating' && (
              <div className="absolute inset-0 bg-white z-10 flex flex-col items-center justify-center text-center p-4 animate-in fade-in zoom-in duration-300">
                  {protocol === 'STP' ? <Timer className="w-10 h-10 mb-4 text-orange-500 animate-pulse" /> : protocol === 'RSTP' ? <Zap className="w-10 h-10 mb-4 text-indigo-500 animate-bounce" /> : <Network className="w-10 h-10 mb-4 text-teal-500 animate-bounce" />}
                  <h3 className={`text-sm font-bold mb-2 ${protocol === 'STP' ? 'text-orange-700' : protocol === 'RSTP' ? 'text-indigo-700' : 'text-teal-700'}`}>포트 상태 전이 대기 중</h3>
                  <div className={`w-full rounded-full h-3 mb-2 overflow-hidden shadow-inner relative ${protocol === 'STP' ? 'bg-orange-100' : protocol === 'RSTP' ? 'bg-indigo-100' : 'bg-teal-100'}`}>
                      <div className={`h-3 rounded-full transition-all duration-100 ease-linear ${protocol === 'STP' ? 'bg-orange-500' : protocol === 'RSTP' ? 'bg-indigo-500' : 'bg-teal-500'}`} style={{ width: `${transitionState.progress}%` }}></div>
                  </div>
              </div>
            )}
            {stpResult.status === 'success' ? (
              <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                <div className={`text-xs font-bold flex items-center ${protocol === 'STP' ? 'text-green-600' : 'text-indigo-600'}`}><CheckCircle2 className="w-4 h-4 mr-1.5" /> {stpResult.message}</div>
                {stpResult.rootBridges.map(r => (
                  <div key={r.id} className="bg-purple-50 p-3 rounded-lg border border-purple-100 shadow-sm">
                    <div className="font-bold text-purple-700 text-xs mb-1">{r.name}</div>
                    <div className="text-[10px] text-gray-500 italic leading-relaxed">사유: {r.reason}</div>
                  </div>
                ))}
              </div>
            ) : stpResult.status === 'error' ? (
                <div className="flex flex-col items-center justify-center text-center text-red-500 mt-4"><AlertTriangle className="w-8 h-8 mb-2 opacity-80" /><p className="text-[11px] font-bold">{stpResult.message}</p></div>
            ) : stpResult.status === 'idle' && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40"><RotateCw className="w-6 h-6 text-gray-300 mb-2" /><p className="text-[11px] text-gray-400 italic">계산 결과가 여기에 표시됩니다</p></div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
