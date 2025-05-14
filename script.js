
let bpmnViewer;
let definitionsJson = null;

window.onload = async function () {
  await fetchData();
  initializeBpmnViewer();
  displayEmptyCanvas();
  populateProcessDropdown();
  loadDiagramsFromLocalStorage();
};

function initializeBpmnViewer() {
  const canvasContainer = document.getElementById('canvas');
  canvasContainer.innerHTML = '';
  const viewerDiv = document.createElement('div');
  viewerDiv.id = 'bpmnCanvas';
  viewerDiv.style.height = '100%';
  canvasContainer.appendChild(viewerDiv);

  bpmnViewer = new BpmnJS({ container: '#bpmnCanvas' });
}

function displayEmptyCanvas() {
  const emptyDiagramXml = `<?xml version="1.0" encoding="UTF-8"?>
  <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                    xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                    targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="Process_1" isExecutable="false"></bpmn:process>
    <bpmndi:BPMNDiagram>
      <bpmndi:BPMNPlane bpmnElement="Process_1"></bpmndi:BPMNPlane>
    </bpmndi:BPMNDiagram>
  </bpmn:definitions>`;
  bpmnViewer.importXML(emptyDiagramXml).then(() => {
    bpmnViewer.get('canvas').zoom('fit-viewport', 'auto');
  }).catch(err => console.error('Error loading empty diagram:', err));
}

async function fetchData() {
  const res = await fetch('data.json');
  const json = await res.json();
  definitionsJson = json['bpmn:definitions'];
}

function populateProcessDropdown() {
  const dropdown = document.getElementById('processSelector');
  const emptyOption= document.createElement('option')
  emptyOption.value="emptyCanvas"
  emptyOption.textContent="new diagram"
    dropdown.appendChild(emptyOption);

  const defaultProcesses = [
    { id: 'leaveRequestProcess', name: 'Leave Request Process' },
    { id: 'Process_1', name: 'Process 1' },
    { id: 'Process_2', name: 'Process 2' }
  ];
  defaultProcesses.forEach(proc => {
    const option = document.createElement('option');
    option.value = proc.id;
    option.textContent = proc.name;
    dropdown.appendChild(option);
  });
}

function loadDiagramsFromLocalStorage() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.endsWith('_xml')) continue;
    const diagramName = key.replace('_xml', '');
    addDiagramToDropdown(diagramName);
  }
}

function addDiagramToDropdown(name) {
  const dropdown = document.getElementById('processSelector');
  if (!Array.from(dropdown.options).some(opt => opt.value === name)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    dropdown.appendChild(option);
  }
}

document.getElementById('processSelector').addEventListener('change', e => {
  const id = e.target.value;
  if (id === 'emptyCanvas') return displayEmptyCanvas();
  if (id === 'leaveRequestProcess') return renderLeaveRequestProcess();
  loadProcessFromStorageOrServer(id);
});

function loadProcessFromStorageOrServer(id) {
  const xml = localStorage.getItem(`${id}_xml`);
  if (xml) {
    loadProcessFromXml(xml);
  } else {
    renderProcess(id);
  }
}

function loadProcessFromXml(xml) {
  bpmnViewer.importXML(xml).then(() => {
    bpmnViewer.get('canvas').zoom('fit-viewport', 'auto');
  }).catch(err => console.error('Error loading XML:', err));
}

function renderProcess(id) {
  if (!definitionsJson) return console.error('Definitions not loaded');
  const procs = [].concat(definitionsJson['bpmn:process']);
  const diags = [].concat(definitionsJson['bpmndi:BPMNDiagram']);
  const proc = procs.find(p => p['@id'] === id);
  const diag = diags.find(d => diagMatches(d, id));
  if (!proc || !diag) return console.error('Process or diagram not found');

  const def = {
    ...definitionsJson,
    'bpmn:process': proc,
    'bpmndi:BPMNDiagram': diag
  };

  const xml = jsonToXml(def, 'bpmn:definitions');
  loadProcessFromXml(xml);
}

function jsonToXml(obj, nodeName) {
  function convert(node, tagName) {
    if (Array.isArray(node)) return node.map(n => convert(n, tagName)).join('');
    let attrs = '', content = '';
    for (const key in node) {
      const val = node[key];
      if (key.startsWith('@')) {
        attrs += ` ${key.slice(1)}="${val}"`;
      } else if (typeof val === 'object') {
        content += convert(val, key);
      } else {
        content += `<${key}>${val}</${key}>`;
      }
    }
    return `<${tagName}${attrs}>${content}</${tagName}>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>` + convert(obj, nodeName);
}

function xmlToJson(xml) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, "application/xml");

  function convert(node) {
    if (node.nodeType === 3) return node.nodeValue.trim();
    const obj = {};
    if (node.attributes) for (const attr of node.attributes) obj[`@${attr.name}`] = attr.value;
    for (const child of node.childNodes) {
      const name = child.nodeName;
      const val = convert(child);
      if (!val) continue;
      if (obj[name]) obj[name] = [].concat(obj[name], val);
      else obj[name] = val;
    }
    return obj;
  }

  return convert(xmlDoc.documentElement);
}

document.getElementById('saveBtn').addEventListener('click', () => {
  const name = prompt("Diagram name:");
  if (!name) return;

  bpmnViewer.saveXML({ format: false }).then(({ xml }) => {
    localStorage.setItem(name, JSON.stringify(xmlToJson(xml)));
    localStorage.setItem(`${name}_xml`, xml);
    addDiagramToDropdown(name);
    displayEmptyCanvas();
    alert('Saved!');
  }).catch(console.error);
});

async function renderLeaveRequestProcess() {
  if (!definitionsJson) return console.error('Definitions not loaded');
  const procs = [].concat(definitionsJson['bpmn:process']);
  const diags = [].concat(definitionsJson['bpmndi:BPMNDiagram']);
  const proc = procs.find(p => p['@id'] === 'leaveRequestProcess');
  const diag = diags.find(d => diagMatches(d, 'leaveRequestProcess'));
  if (!proc || !diag) return console.error('LeaveRequest process not found');

  const xml = buildLeaveRequestXml(definitionsJson, proc, diag);
  loadProcessFromXml(xml);
}

function diagMatches(d, id) {
  const plane = d['bpmndi:BPMNPlane'];
  return (plane['@bpmnElement'] || plane['bpmnElement']) === id;
}

function buildLeaveRequestXml(defJson, proc, diag) {
  const ns = [
    `xmlns:bpmn="${defJson['@xmlns:bpmn']}"`,
    `xmlns:bpmndi="${defJson['@xmlns:bpmndi']}"`,
    `xmlns:dc="${defJson['@xmlns:dc']}"`,
    `xmlns:di="${defJson['@xmlns:di']}"`
  ].join(' ');

  const procXml = jsonToXml(proc, 'bpmn:process');
  const diagXml = jsonToXml(diag, 'bpmndi:BPMNDiagram');

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
         `<bpmn:definitions ${ns} id="${defJson['@id']}" targetNamespace="${defJson['@targetNamespace']}">\n` +
         procXml + '\n' + diagXml + '\n</bpmn:definitions>';
}





