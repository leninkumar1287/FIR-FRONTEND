import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/plugins/regions';

function Header({ tab, setTab }) {
  return (
    <header className="fir-header">
      <div className="fir-header-left">
        <h1>Generate FIR</h1>
        <nav>
          <span className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Register FIR</span>
          <span className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</span>
        </nav>
      </div>
      <div className="fir-header-right">
        <span className="material-icons">share</span>
        <span className="material-icons">edit</span>
        <span className="material-icons">more_vert</span>
      </div>
    </header>
  );
}

function AudioPanel({ transcription, setTranscription, onTranscriptionDone }) {
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isWaveformReady, setIsWaveformReady] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const fileInputRef = useRef();
  const wavesurferRef = useRef(null);
  const waveformContainerRef = useRef();

  // Format time in MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize wavesurfer
  useEffect(() => {
    if (audioUrl && waveformContainerRef.current) {
      const container = waveformContainerRef.current;
      if (!container.offsetWidth || !container.offsetHeight) return;
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      setIsWaveformReady(false);
      setTimeout(() => {
        try {
          const ws = WaveSurfer.create({
            container: container,
            waveColor: '#222',
            progressColor: '#1976d2',
            height: 40,
            barWidth: 3,
            responsive: true,
            plugins: [
              RegionsPlugin.create({
                dragSelection: true,
                regions: [],
              })
            ]
          });
          ws.load(audioUrl);
          ws.on('ready', () => {
            setIsWaveformReady(true);
            setDuration(ws.getDuration());
            handleTranscribe(audioFile, language); // Start transcription when waveform is ready
          });
          ws.on('audioprocess', () => {
            setCurrentTime(ws.getCurrentTime());
          });
          ws.on('finish', () => {
            setIsPlaying(false);
            setCurrentTime(ws.getDuration());
          });
          ws.on('error', (err) => {
            setError('Failed to load audio. Please upload a valid audio file.');
            setAudioFile(null);
            setAudioUrl('');
            setDuration(0);
            setCurrentTime(0);
            ws.destroy();
          });
          ws.on('play', () => setIsPlaying(true));
          ws.on('pause', () => setIsPlaying(false));
          wavesurferRef.current = ws;
        } catch (err) {
          setError('Failed to load audio. Please upload a valid audio file.');
          setAudioFile(null);
          setAudioUrl('');
          setDuration(0);
          setCurrentTime(0);
        }
      }, 200);
      return () => {
        if (wavesurferRef.current) wavesurferRef.current.destroy();
      };
    }
  }, [audioUrl, language]);

  const handleTranscribe = async (file, selectedLanguage) => {
    if (!file || !selectedLanguage) return;
    
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('language', selectedLanguage);

    try {
      setIsTranscribing(true);
      setTranscription(''); // Clear previous transcription while loading
      const response = await fetch('http://localhost:3000/openai/transcribe', {
        method: 'POST',
        body: formData,
      });
      console.log("response : ", response);
      if (!response.ok) throw new Error('Transcription failed');
      
      const data = await response.json();
      setTranscription(data.text);
      onTranscriptionDone(data.text);
    } catch (err) {
      setError('Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handlePlayPause = () => {
    if (!wavesurferRef.current || !isWaveformReady) return;
    wavesurferRef.current.playPause();
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('audio/')) {
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setError('');
    } else {
      setError('Please upload an audio file.');
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDelete = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }
    setAudioFile(null);
    setAudioUrl('');
    setError('');
    setCurrentTime(0);
    setDuration(0);
    setTranscription(''); // Clear transcription when audio is deleted
  };

  return (
    <div className="fir-card audio-panel">
      <div className="fir-panel-header">
        <span>Record Statement</span>
        <select 
          value={language} 
          onChange={e => setLanguage(e.target.value)} 
          style={{marginRight: '1rem', padding: '0.3rem 0.7rem', borderRadius: 6}}
        >
          <option value="">Select Language</option>
          <option value="hi">Hindi</option>
          <option value="en">English</option>
        </select>
      </div>
      <div
        className={`audio-controls-row${dragActive ? ' drag-active' : ''}`}
        style={{ background: '#f5f6fa', borderRadius: 12, padding: '1rem', alignItems: 'center', position: 'relative' }}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        {!audioFile && (
          <>
            <button
              className="audio-upload-btn"
              type="button"
              onClick={() => {
                if (!language) {
                  setError('Please select a language before uploading audio.');
                  return;
                }
                handleClickUpload();
              }}
              disabled={!language}
            >
              <span className="material-icons">upload</span> Upload Audio
            </button>
            <span style={{marginLeft: 12, color: '#888', fontSize: '0.98rem'}}> or drag & drop audio here</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
          </>
        )}
        {audioFile && (
          <>
            <button className="audio-btn" onClick={handlePlayPause} style={{marginRight: 8}} disabled={!isWaveformReady}>
              <span className="material-icons">{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
            <div ref={waveformContainerRef} style={{ flex: 1, height: 40, background: '#f5f6fa', borderRadius: 8 }} />
            <span className="audio-timer">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <span className="material-icons audio-icon" title="Delete" onClick={handleDelete}>delete</span>
          </>
        )}
        {dragActive && (
          <div className="audio-drag-overlay">Drop audio file here</div>
        )}
      </div>
      {error && <div style={{ color: '#d32f2f', marginTop: 8 }}>{error}</div>}
      <div className="transcription-box">
        <div className="transcription-label">Statement</div>
        <textarea 
          value={transcription} 
          onChange={e => {
            setTranscription(e.target.value);
            onTranscriptionDone(e.target.value);
          }} 
          style={{ width: '100%', height: '220px', resize: 'none' }}
          placeholder={isTranscribing ? "Transcribing audio..." : "Transcription will appear here"}
          disabled={isTranscribing}
        />
      </div>
    </div>
  );
}

function FIRFormPanel({ form, setForm }) {
  return (
    <div className="fir-card fir-form-panel" style={{width:'115%'}}>
      <div className="fir-panel-header">
        <span>FIR Application</span>
        <div>
          <span className="material-icons">file_download</span>
          <span className="material-icons">delete</span>
        </div>
      </div>
      <div className="fir-section">
        <div className="fir-section-header">
          <span>Complainant Details</span>
          <span className="material-icons fir-tooltip">help_outline</span>
        </div>
        <div className="form-row">
          <label>Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <label>Age</label>
          <div className="age-input-group">
            <button onClick={() => setForm(f => ({ ...f, age: Math.max(0, f.age - 1) }))}>-</button>
            <input type="text" width="120%" value={form.age ? form.age : ''} onChange={e => setForm(f => ({ ...f, age: Number(e.target.value) }))} />
            <button onClick={() => setForm(f => ({ ...f, age: f.age + 1 }))}>+</button>
          </div>
        </div>
        <div className="form-row">
          <label>Phone Number</label>
          <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <label>Gender</label>
          <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}><option>Male</option><option>Female</option></select>
        </div>
        <div className="form-row">
          <label>Address</label>
          <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
      </div>
      <div className="fir-section">
        <div className="fir-section-header">
          <span>Incident Details</span>
          <span className="material-icons fir-tooltip">help_outline</span>
        </div>
        <div className="form-row">
          <label>Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <label>Time</label>
          <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
        </div>
        <div className="form-row">
          <label>Location</label>
          <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        </div>
        <div className="form-row">
          <label>Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%' }} />
        </div>
        <div className="form-row">
          <label>Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}><option value="">Type</option></select>
          <label>Severity</label>
          <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}><option value="">Severity</option></select>
        </div>
      </div>
    </div>
  );
}

function MasterDataPanel({ tab, setTab, form }) {
  const [activeCategory, setActiveCategory] = useState('intent');
  const [events, setEvents] = useState(null);
  const [modalities, setModalities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('');
  const [error, setError] = useState(null);

  // Keep the original incident categories
  const incidentCategories = [
    'Intent',
    'Event Condition',
    'Method',
    'Location',
    'Victim Context',
    'Offender Attributes',
    'Property Type',
  ];

  const categories = {
    intent: [
      'Dishonest Intent to Take',
      'Dishonest Inducement by Fear',
      'Attempt to Extort',
      'Attempt Extortion with Severe Threat',
      'Induce Delivery by Threat'
    ],
    event: [
      'Coercion Through False Charge',
      'Extortion Through False Crime Allegation',
      'Commit Theft with Force or Fear',
      'Extort by Instilling Instant Fear'
    ],
    method: [
      'Intent to Commit Robbery',
      'Commit Robbery with Possibility of Hurt',
      'Attempt Robbery with Possibility of Hurt'
    ],
    offender: [
      'Commit Robbery as Group',
      'Attempt Dacoity with Group',
      'Commit Dacoity with Possibility of Fatal Force'
    ],
    property: [
      'Prepare to Commit Dacoity',
      'Gather to Commit Dacoity',
      'Habitual Dacoity Participation'
    ],
    time: [
      'Commit Robbery or Dacoity with Lethal Force',
      'Attempt Robbery or Dacoity with Weapon'
    ]
  };

  const categoryLabels = {
    intent: 'Intent',
    event: 'Event Condition',
    method: 'Method',
    offender: 'Offender Attributes',
    property: 'Property Type',
    time: 'Time'
  };

  const analyzeDescription = async () => {
    setLoading(true);
    setError(null);
    try {
      // First analyze events
      setAnalysisStage('Analyzing event sequence...');
      const eventsResponse = await fetch('http://localhost:3000/openai/analyze-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: form.description })
      });
      
      if (!eventsResponse.ok) throw new Error('Failed to analyze events');
      const eventsData = await eventsResponse.json();
      setEvents(eventsData);

      // Then analyze modalities based on events
      setAnalysisStage('Detecting crime modalities...');
      const modalitiesResponse = await fetch('http://localhost:3000/openai/analyze-modalities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: eventsData })
      });

      if (!modalitiesResponse.ok) throw new Error('Failed to analyze modalities');
      const modalitiesData = await modalitiesResponse.json();
      setModalities(modalitiesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setAnalysisStage('');
    }
  };

  const renderEvents = () => {
    if (!events?.event_segments) return null;
    return (
      <div className="analysis-section">
        <h3>Event Sequence</h3>
        <div className="event-timeline">
          {events.event_segments.map((event, index) => (
            <div key={event.event_id} className="event-card">
              <div className="event-header">
                <span className="event-id">{event.event_id}</span>
                <span className="event-type">{event.type}</span>
              </div>
              <div className="event-name">{event.event_name}</div>
              <div className="event-text">{event.text}</div>
              <div className="event-details">
                {event.timestamp_text && <div><strong>When:</strong> {event.timestamp_text}</div>}
                {event.location && <div><strong>Where:</strong> {event.location}</div>}
                {event.actors_involved?.length > 0 && (
                  <div><strong>Who:</strong> {event.actors_involved.join(', ')}</div>
                )}
              </div>
              {event.is_crucial && <div className="event-crucial">Crucial Event</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderModalities = () => {
    if (!modalities) return null;
    return (
      <div className="analysis-section">
        <h3>Crime Modalities</h3>
        <div className="modalities-grid">
          {Object.entries(modalities).map(([category, values]) => (
            <div key={category} className="modality-card">
              <div className="modality-header">{category.replace(/_/g, ' ').toUpperCase()}</div>
              <div className="modality-values">
                {values.map((value, index) => (
                  <div key={index} className="modality-value">
                    {value.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fir-card">
      <div className="fir-panel-header">
        <div className="tab-header">
          <button 
            className={`tab-button ${tab === 'master' ? 'active' : ''}`}
            onClick={() => setTab('master')}
          >
            Master Data
          </button>
          <button 
            className={`tab-button ${tab === 'incident' ? 'active' : ''}`}
            onClick={() => setTab('incident')}
          >
            Incident Data
          </button>
        </div>
      </div>
      
      {tab === 'master' ? (
        <div className="master-data-container">
          <div className="master-data-content">
            <ul className="master-list">
              {categories[activeCategory].map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="vertical-tabs">
            {Object.entries(categoryLabels).map(([key, label]) => (
              <div
                key={key}
                className={`vertical-tab ${activeCategory === key ? 'active' : ''}`}
                onClick={() => setActiveCategory(key)}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="incident-data-panel">
          {loading && (
            <div className="analysis-loading">
              <div className="analysis-spinner"></div>
              <div className="analysis-loading-text">{analysisStage}</div>
            </div>
          )}
          {!events ? (
            <button 
              className="analyze-btn incident-analyze-btn" 
              onClick={analyzeDescription}
              disabled={loading || !form?.description}
            >
              {loading ? 'Analyzing...' : 'Analyze Crime'}
            </button>
          ) : (
            <>
              {error && <div className="analysis-error">{error}</div>}
              {renderEvents()}
              {renderModalities()}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewPage({ form, firText, sections, setSections, onBack }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newSection, setNewSection] = useState({ name: '', description: '', ipc: '' });
  const [showTools, setShowTools] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [letterFormat, setLetterFormat] = useState(true);
  const [history, setHistory] = useState([firText]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [bnsResults, setBnsResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const firRef = useRef();
  const firContentRef = useRef();
  const [selectedSection, setSelectedSection] = useState(null);

  useEffect(() => {
    // Fetch BNS predictions when component mounts
    const fetchBnsPredictions = async () => {
      try {
        setIsLoading(true);
        // First get modalities from analyze-modalities endpoint
        const modalitiesResponse = await fetch('http://localhost:3000/openai/analyze-modalities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description: firText })
        });

        if (!modalitiesResponse.ok) throw new Error('Failed to analyze modalities');
        const modalitiesData = await modalitiesResponse.json();

        // Then send modalities to predict_bns endpoint
        const bnsResponse = await fetch('http://localhost:5000/predict_bns', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(modalitiesData)
        });

        if (!bnsResponse.ok) throw new Error('Failed to predict BNS sections');
        const bnsData = await bnsResponse.json();
        
        // Update sections with BNS predictions
        const newSections = bnsData.results.map(result => ({
          name: result.predicted_offence,
          description: `Intent: ${result.intent}. Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%`,
          ipc: result.predicted_bns_section
        }));
        
        setBnsResults(bnsData);
        setSections(newSections);
      } catch (error) {
        console.error('Error fetching BNS predictions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBnsPredictions();
  }, [firText]);

  // Basic keyword-to-section mapping for demo
  const sectionKeywords = [
    { keyword: 'मारपीट', section: 'Physical Assault', ipc: 'IPC Section 351', description: 'The complainant was assaulted.' },
    { keyword: 'गाली', section: 'Verbal Abuse and Threat', ipc: 'IPC Section 115(2)', description: 'Abusive and threatening language was used.' },
    { keyword: 'समूह', section: 'Group Conspiracy', ipc: 'IPC Section 3(5)', description: 'Attackers acted as a group.' },
  ];

  // When user selects text, auto-suggest section
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (!selection || !firRef.current) return;
    const selectedText = selection.toString();
    if (selectedText.length > 0) {
      // Find matching section
      const found = sectionKeywords.find(sk => selectedText.includes(sk.keyword));
      if (found && !sections.some(s => s.name === found.section)) {
        setSections(secs => [...secs, { name: found.section, description: found.description, ipc: found.ipc }]);
      }
    }
  };

  // Remove a section
  const removeSection = (name) => {
    setSections(secs => secs.filter(s => s.name !== name));
  };

  // Add new section
  const handleAddSection = () => {
    if (newSection.name && newSection.description && newSection.ipc) {
      setSections(secs => [...secs, { ...newSection }]);
      setShowAdd(false);
      setNewSection({ name: '', description: '', ipc: '' });
    }
  };

  // Toolbar actions
  const handleToolbar = (action) => {
    if (action === 'file-download') {
      // Download FIR in letter format
      downloadLetterFormat();
    } else if (action === 'edit-undo') {
      if (historyIdx > 0) {
        setHistoryIdx(idx => idx - 1);
      }
    } else if (action === 'edit-redo') {
      if (historyIdx < history.length - 1) {
        setHistoryIdx(idx => idx + 1);
      }
    } else if (action === 'view-toggle') {
      setLetterFormat(f => !f);
    } else if (action === 'insert-date') {
      insertAtCursor(new Date().toLocaleDateString());
    } else if (action === 'insert-time') {
      insertAtCursor(new Date().toLocaleTimeString());
    } else if (action === 'format-bold') {
      formatSelection('bold');
    } else if (action === 'format-italic') {
      formatSelection('italic');
    } else if (action === 'format-underline') {
      formatSelection('underline');
    } else if (action === 'tools') {
      setShowTools(true);
    } else if (action === 'help') {
      setShowHelp(true);
    }
  };

  // Insert text at cursor in FIR report (for Insert menu)
  const insertAtCursor = (text) => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
  };

  // Format selected text (for Format menu)
  const formatSelection = (type) => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let wrapper;
    if (type === 'bold') {
      wrapper = document.createElement('b');
    } else if (type === 'italic') {
      wrapper = document.createElement('i');
    } else if (type === 'underline') {
      wrapper = document.createElement('u');
    }
    if (wrapper) {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    }
  };

  // Download FIR in DOC format
  const downloadLetterFormat = async () => {
    try {
      setIsDownloading(true);
      const response = await fetch('http://localhost:3000/fir/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          form,
          firText,
          sections: sections || []
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Download error:', errorData);
        throw new Error(errorData.details || 'Download failed');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'FIR.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error downloading FIR:', error);
      alert(`Failed to download FIR: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Letter format rendering
  const renderLetterFormat = () => (
    <div className="fir-report-layout">
      <div className="fir-report-left">
        <div className="fir-complaint-number">
          कार्यवाही अपराध क्रमांक /25 थाना 296, 115(2), 351(2), 3(5) आईपीसी, द्वारा
        </div>
      </div>
      <div className="fir-report-right">
        <div className="fir-letter-content">
        <h3 style={{textAlign: 'center'}}>First Information Report</h3>
          {/* <div>कार्यवाही अपराध क्रमांक /25 थाना 296, 115(2), 351(2), 3(5) आईपीसी, द्वारा</div> */}
          <div style={{marginTop: '1rem'}}>
            <div>नाम फरियादी: {form.name}</div>
            <div>आरोपी: -</div>
            <div>घटना स्थल: {form.location}</div>
            <div>घटना दिनांक समय: {form.date} के {form.time} बजे करीब</div>
            <div>कार्यवाही दिनांक समय: {new Date().toLocaleDateString()}</div>
            <div>कार्यवाहीकर्ता: प्रकार -</div>
          </div>
          <div style={{marginTop: '1.5rem'}}>
            <div>विवरण - फरियादी:</div>
            <div style={{marginTop: '1rem', whiteSpace: 'pre-line'}}>{firText}</div>
          </div>
          <div style={{marginTop: '3rem', display: 'flex', justifyContent: 'space-between'}}>
            <div>
              <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
              <div><strong>Place:</strong> Mumbai</div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div>Faithfully,</div>
              <div style={{height: '60px'}}></div>
              <div>Complainant's Signature</div>
              <div>({form.name || ''})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Plain format rendering
  const renderPlainFormat = () => (
    <div style={{ whiteSpace: 'pre-line', fontFamily: 'inherit' }}>{firText}</div>
  );

  return (
    <div className="fir-preview-layout">
      <div className="fir-preview-col left">
        <div className="fir-card fir-preview-report" style={{width: '100%'}}>
          <div className="fir-panel-header">
            First Information Report
            <button 
              className="download-fir-btn" 
              onClick={downloadLetterFormat}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <span className="material-icons loading">sync</span>
                  Downloading...
                </>
              ) : (
                <>
                  <span className="material-icons">file_download</span>
                  Download FIR
                </>
              )}
            </button>
          </div>
          <div className="fir-report-content" ref={firRef} onMouseUp={handleTextSelect}>
            {letterFormat ? renderLetterFormat() : renderPlainFormat()}
          </div>
        </div>
      </div>
      <div className="fir-preview-col right">
        <div className="fir-card fir-preview-sections">
          <div className="fir-panel-header">
            Details of Wrongdoings
            <button className="add-section-btn" onClick={() => setShowAdd(true)}>
              <span className="material-icons">add</span> Add
            </button>
          </div>
          {isLoading ? (
            <div className="sections-loading">
              <div className="spinner"></div>
              <div>Analyzing sections...</div>
            </div>
          ) : (
            <div className="fir-section-cards">
              {sections.map((s, i) => (
                <div 
                  className={`fir-section-card${selectedSection === i ? ' selected' : ''}`} 
                  key={s.name} 
                  onClick={() => setSelectedSection(i)}
                >
                  <div className="fir-section-card-header">
                    <span>{s.name}</span>
                    <span className="material-icons success">check</span>
                    <span 
                      className="material-icons remove" 
                      onClick={e => { 
                        e.stopPropagation(); 
                        removeSection(s.name); 
                      }}
                    >
                      close
                    </span>
                  </div>
                  <div className="fir-section-card-desc">{s.description}</div>
                  <div className="fir-section-card-ipc">{s.ipc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {showAdd && (
          <div className="fir-modal-bg">
            <div className="fir-modal">
              <h3>Add Section</h3>
              <input placeholder="Section Name" value={newSection.name} onChange={e => setNewSection(s => ({ ...s, name: e.target.value }))} />
              <textarea placeholder="Description" value={newSection.description} onChange={e => setNewSection(s => ({ ...s, description: e.target.value }))} />
              <input placeholder="IPC Section" value={newSection.ipc} onChange={e => setNewSection(s => ({ ...s, ipc: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="generate-fir-btn" onClick={handleAddSection}>Add</button>
                <button className="validate-btn" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {showTools && (
          <div className="fir-modal-bg"><div className="fir-modal"><h3>Tools</h3><div>Tools coming soon...</div><button className="generate-fir-btn" onClick={() => setShowTools(false)}>Close</button></div></div>
        )}
        {showHelp && (
          <div className="fir-modal-bg"><div className="fir-modal"><h3>Help</h3><div>Help and documentation coming soon...</div><button className="generate-fir-btn" onClick={() => setShowHelp(false)}>Close</button></div></div>
        )}
      </div>
    </div>
  );
}

function parseHindiTranscriptionToForm(text) {
  // Dummy parser: just fills name, address, phone if found in text
  // In real use, use NLP or regex for better extraction
  let name = '';
  let address = '';
  let phone = '';
  let age = 0;
  let location = '';
  let description = text;
  // Example: extract name after 'मेरा नाम'
  const nameMatch = text.match(/मेरा नाम ([^ ]+)/);
  if (nameMatch) name = nameMatch[1];
  const phoneMatch = text.match(/([0-9]{10})/);
  if (phoneMatch) phone = phoneMatch[1];
  // You can add more parsing rules here
  return {
    name,
    age,
    phone,
    gender: 'Male',
    address,
    date: '',
    time: '',
    location,
    description,
    type: '',
    severity: '',
  };
}

// Sample crime scenarios
const crimeScenarios = {
  rural_theft: {
    title: "Rural Theft Case - Chhindwara",
    complainant: {
      name: "Ramesh Bhaiya Dhurve",
      age: 41,
      address: "Lodhikheda, District Chhindwara",
      phone: "9826312312",
      gender: "Male",
      profession: "Farmer"
    },
    incident: {
      date: "2024-03-25",
      time: "22:00",
      location: "Near Tube-well, Lodhikheda Village",
      description: `Sahab, mera naam Ramesh Dhurve hai. Main Lodhikheda ka rehne wala hoon. Pichle teen din se mera mann shaant nahi hai. Sab kuch ulta-pulta ho gaya hai. Jo kuch bhi batane jaa raha hoon, woh sach hai aur aap jaise officer hi meri madad kar sakte hain.

Sabse pehle toh, teen din pehle — ya shayad chaar — main apne khet se raat ko der se laut raha tha. Mera chhota bhai Golu bola tha ki ek aadmi borewell ke paas ghusta dikha. Main samjha gaay hogi, par raat 10 baje ka samay tha. Agle din jab gaya toh dekha ki mera chhota inverter, jo tube-well chalata tha, woh gayab tha.

Phir mujhe yaad aaya ki kuch din pehle Bhura Meena ka ladka Rinku mere ghar ke paas kuch pooch raha tha — 'Bhaiya yeh inverter kitne ka liya?' Mujhe tab kuch khaas nahi laga, par ab sab kuch mila ke ajeeb lag raha hai. Waise bhi Rinku pehle bhi chori ke chakkar mein pakda gaya tha, do mahine jail bhi gaya tha woh Itarsi se.`,
      type: "Theft",
      severity: "Medium"
    },
    sections: [
      { name: "Theft", description: "Theft of inverter and livestock", ipc: "IPC Section 379" },
      { name: "Criminal Trespass", description: "Unauthorized entry into property", ipc: "IPC Section 447" },
      { name: "Previous Offender", description: "Suspect has prior theft conviction", ipc: "IPC Section 75" }
    ]
  },
  urban_theft_attempt: {
    title: "Urban Theft + Attempted Murder - Betul",
    complainant: {
      name: "Sunita Vishwakarma",
      age: 34,
      address: "Civil Lines, Betul",
      phone: "9341027861",
      gender: "Female",
      profession: "Tailor"
    },
    incident: {
      date: "2024-03-28",
      time: "20:45",
      location: "Sunita Silks Boutique, Civil Lines, Betul",
      description: `Sir, main Sunita Vishwakarma hoon, Civil Lines Betul mein meri boutique hai — 'Sunita Silks'. 28 tarik ki raat ko jo hua, usne meri zindagi palat di. Aap samajh rahe hain na, main ab tak sambhal nahi paayi hoon.

Sab kuch tab shuru hua jab mere husband Vinod ne mujhe bola ki boutique ka storeroom ka tala tut gaya hai. Main raat ke 8:45 baje boutique pahunchi, toh dekha ki generator aur silai machine ka spare motor gayab tha. Par us waqt humein laga ki chori hi hui hai, isse zyada kuch nahi.

Lekin jab hamare chhote bhai Sandeep boutique ke peeche ki gali mein gaya, toh dekha ki wahan khoon pada hai — ek bada sa khoon ka dhabba. Aur usi samay hamein pata chala ki boutique ka naukar, Bhura Bhaiya — jo din bhar safai karta hai — woh laapata hai.`,
      type: "Theft with Violence",
      severity: "High"
    },
    sections: [
      { name: "Theft", description: "Theft of generator and machine parts", ipc: "IPC Section 379" },
      { name: "Attempt to Murder", description: "Assault causing grievous injury to worker", ipc: "IPC Section 307" },
      { name: "Breaking and Entering", description: "Forceful entry into business premises", ipc: "IPC Section 457" }
    ]
  },
  family_dispute: {
    title: "Family Dispute + Verbal Abuse - Harda",
    complainant: {
      name: "Dulari Bai Sahu",
      age: 48,
      address: "Near Old Bus Stand, Harda",
      phone: "9300885552",
      gender: "Female",
      profession: "Homemaker"
    },
    incident: {
      date: "2024-03-20",
      time: "20:00",
      location: "Residence near Old Bus Stand, Harda",
      description: `Pranam Sir,
Main Dulari Bai hoon, Harda ke Purane Bus Stand ke paas rahti hoon. Pichle kuch mahino se main apne bade devar — Arvind Sahu — se bahut pareshan hoon. Yeh ab personal se family problem nahi rahi — ab mental torture ban chuki hai.

Mere pati Kailash Sahu ki maut 3 saal pehle ho gayi thi. Uske baad main aur meri beti Sonal yahan ek chhote se makan mein reh rahe hain. Makan virasat ka tha, jo mere sasur ke naam par tha. Maut ke baad sab kuch mere pati ke naam transfer hua — aur is wajah se Arvind humse jala hua tha.`,
      type: "Domestic Dispute",
      severity: "Medium"
    },
    sections: [
      { name: "Criminal Intimidation", description: "Threats and verbal abuse", ipc: "IPC Section 506" },
      { name: "Insulting Modesty", description: "Verbal harassment of women", ipc: "IPC Section 509" }
    ]
  },
  dowry_case: {
    title: "Dowry-Related Suicide - Tikamgarh",
    complainant: {
      name: "Ganga Prasad Kushwaha",
      age: 53,
      address: "Mohangarh, Tikamgarh District",
      phone: "9630254457",
      gender: "Male",
      profession: "Farmer"
    },
    incident: {
      date: "2024-03-29",
      time: "06:00",
      location: "Victim's Marital Home, Kolar",
      description: `Pranam Thana Adhyaksh Mahoday,
Main Ganga Prasad hoon, Mohangarh gaon se. Mera dil toota hua hai. Meri beti Anjali Kushwaha ne kal subah 6 baje ke aas-paas apne sasural mein phaansi laga li. Vo sirf 20 saal ki thi. Sirf ek saal hua tha uski shaadi ko — ek saal bhi poora nahi hua tha.

Uski shaadi pichle saal Sawan mahine mein, Kolar ke Ravi Ahirwar ke saath hui thi. Shuru mein sab thik tha. Humne dahej mein ₹1.5 lakh cash, bike, 4 tola sona aur bistar diya tha. Par shaadi ke do mahine baad se hi, Ravi ke maa-baap ne taana maarna shuru kar diya.`,
      type: "Dowry Death",
      severity: "Critical"
    },
    sections: [
      { name: "Dowry Death", description: "Death related to dowry demands", ipc: "IPC Section 304B" },
      { name: "Cruelty by Husband/Relatives", description: "Mental and physical harassment", ipc: "IPC Section 498A" },
      { name: "Abetment to Suicide", description: "Driving victim to suicide", ipc: "IPC Section 306" }
    ]
  }
};

// Simulation Panel Component
function SimulationPanel({ onSelectScenario }) {
  return (
    <div className="fir-card simulation-panel">
      <div className="fir-panel-header">
        <span>Crime Scenarios</span>
        <span className="material-icons">psychology</span>
      </div>
      <div className="simulation-scenarios">
        {Object.entries(crimeScenarios).map(([key, scenario]) => (
          <div 
            key={key} 
            className="scenario-card"
            onClick={() => onSelectScenario(scenario)}
          >
            <div className="scenario-title">{scenario.title}</div>
            <div className="scenario-type">{scenario.incident.type}</div>
            <div className={`scenario-severity ${scenario.incident.severity.toLowerCase()}`}>
              {scenario.incident.severity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisPanel({ form }) {
  const [events, setEvents] = useState(null);
  const [modalities, setModalities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeDescription = async () => {
    setLoading(true);
    setError(null);
    try {
      // First analyze events
      const eventsResponse = await fetch('http://localhost:3000/openai/analyze-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: form.description })
      });
      
      if (!eventsResponse.ok) throw new Error('Failed to analyze events');
      const eventsData = await eventsResponse.json();
      setEvents(eventsData);

      // Then analyze modalities based on events
      const modalitiesResponse = await fetch('http://localhost:3000/openai/analyze-modalities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: eventsData })
      });

      if (!modalitiesResponse.ok) throw new Error('Failed to analyze modalities');
      const modalitiesData = await modalitiesResponse.json();
      setModalities(modalitiesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderEvents = () => {
    if (!events?.event_segments) return null;
    return (
      <div className="analysis-section">
        <h3>Event Sequence</h3>
        <div className="event-timeline">
          {events.event_segments.map((event, index) => (
            <div key={event.event_id} className="event-card">
              <div className="event-header">
                <span className="event-id">{event.event_id}</span>
                <span className="event-type">{event.type}</span>
              </div>
              <div className="event-name">{event.event_name}</div>
              <div className="event-text">{event.text}</div>
              <div className="event-details">
                {event.timestamp_text && <div><strong>When:</strong> {event.timestamp_text}</div>}
                {event.location && <div><strong>Where:</strong> {event.location}</div>}
                {event.actors_involved?.length > 0 && (
                  <div><strong>Who:</strong> {event.actors_involved.join(', ')}</div>
                )}
              </div>
              {event.is_crucial && <div className="event-crucial">Crucial Event</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderModalities = () => {
    if (!modalities) return null;
    return (
      <div className="analysis-section">
        <h3>Crime Modalities</h3>
        <div className="modalities-grid">
          {Object.entries(modalities).map(([category, values]) => (
            <div key={category} className="modality-card">
              <div className="modality-header">{category.replace(/_/g, ' ').toUpperCase()}</div>
              <div className="modality-values">
                {values.map((value, index) => (
                  <div key={index} className="modality-value">
                    {value.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fir-card analysis-panel">
      <div className="fir-panel-header">
        <span>Crime Analysis</span>
        <button 
          className="analyze-btn"
          onClick={analyzeDescription}
          disabled={loading || !form.description}
        >
          {loading ? 'Analyzing...' : 'Analyze Crime'}
        </button>
      </div>
      {error && <div className="analysis-error">{error}</div>}
      {loading && <div className="analysis-loading">Analyzing crime patterns...</div>}
      {renderEvents()}
      {renderModalities()}
    </div>
  );
}

function App() {
  const [mainTab, setMainTab] = useState('register');
  const [rightTab, setRightTab] = useState('master');
  const [transcription, setTranscription] = useState('');
  const [form, setForm] = useState({
    name: '',
    age: 0,
    phone: '',
    gender: 'Male',
    address: '',
    date: '',
    time: '',
    location: '',
    description: '',
    type: '',
    severity: '',
  });
  const [sections, setSections] = useState([
    { name: 'Physical Assault', description: 'The complainant, Rajesh Kumar, was slapped and attacked on the neck; his friend \'Raja\' was also assaulted', ipc: 'IPC Section 351' },
    { name: 'Verbal Abuse and Threat', description: 'Abusive and threatening language was used by the attackers.', ipc: 'IPC Section 115(2)' },
    { name: 'Group Conspiracy', description: 'Attackers acted as a group and brought additional assailants to escalate the situation.', ipc: 'IPC Section 3(5)' },
  ]);

  // When transcription is done, parse and fill form
  const handleTranscriptionDone = (text) => {
    const parsed = parseHindiTranscriptionToForm(text);
    setForm(f => ({ ...f, ...parsed }));
  };

  // FIR text for preview (use form.description or transcription)
  const firText = form.description || transcription;

  const handleScenarioSelect = (scenario) => {
    setForm({
      name: scenario.complainant.name,
      age: scenario.complainant.age,
      phone: scenario.complainant.phone,
      gender: scenario.complainant.gender,
      address: scenario.complainant.address,
      date: scenario.incident.date,
      time: scenario.incident.time,
      location: scenario.incident.location,
      description: scenario.incident.description,
      type: scenario.incident.type,
      severity: scenario.incident.severity,
    });
    setSections(scenario.sections);
  };

  return (
    <div className="fir-root">
      <Header tab={mainTab} setTab={setMainTab} />
      {mainTab === 'register' ? (
        <div className="fir-app-layout">
          <div className="fir-col left">
            <AudioPanel transcription={transcription} setTranscription={setTranscription} onTranscriptionDone={handleTranscriptionDone} />
            <SimulationPanel onSelectScenario={handleScenarioSelect} />
          </div>
          <div className="fir-col center">
            <FIRFormPanel form={form} setForm={setForm} />
          </div>
          <div className="fir-col right" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <MasterDataPanel tab={rightTab} setTab={setRightTab} form={form} />
            </div>
            <button className="generate-fir-btn" onClick={() => setMainTab('preview')}>Generate FIR</button>
          </div>
        </div>
      ) : (
        <PreviewPage form={form} firText={firText} sections={sections} setSections={setSections} onBack={() => setMainTab('register')} />
      )}
    </div>
  );
}

export default App;
