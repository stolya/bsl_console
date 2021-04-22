require.config( { 'vs/nls': { availableLanguages: { '*': "ru" } } } );

define(['bslGlobals', 'bslMetadata', 'snippets', 'bsl_language', 'vs/editor/editor.main', 'actions', 'bslQuery', 'bslDCS'], function () {

  selectionText = '';
  engLang = false;
  decorations = [];
  contextData = new Map();
  generateModificationEvent = false;
  readOnlyMode = false;
  queryMode = false;
  DCSMode = false;
  version1C = '';
  contextActions = [];
  customHovers = {};
  originalText = '';
  metadataRequests = new Map();
  customSuggestions = [];
  contextMenuEnabled = false;
  err_tid = 0;
  suggestObserver = null;
  generateBeforeShowSuggestEvent = false;
  generateSelectSuggestEvent = false;

  reserMark = function() {

    clearInterval(err_tid);
    decorations = editor.deltaDecorations(decorations, []);

  }

  sendEvent = function(eventName, eventParams) {

    let lastEvent = new MouseEvent('click');
    lastEvent.eventData1C = {event : eventName, params: eventParams};
    return dispatchEvent(lastEvent);
    
  }

  setText = function(txt, range, usePadding) {
    
    reserMark();
    bslHelper.setText(txt, range, usePadding);    

  }

  updateText = function(txt, range, usePadding) {

    readOnly = readOnlyMode;
    modEvent = generateModificationEvent;
    
    if (readOnly)
      setReadOnly(false);

    if (modEvent)    
      enableModificationEvent(false);

    eraseText();
    setText(txt, range, usePadding);

    if (modEvent)    
      enableModificationEvent(true);

    if (readOnly)
      setReadOnly(true);

  }

  eraseText = function () {
    
    setText('', editor.getModel().getFullModelRange(), false);    

  }

  getText = function(txt) {

    return editor.getValue();

  }

  getQuery = function () {

    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		
    return bsl.getQuery();

  }

  getFormatString = function () {

    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		
    return bsl.getFormatString();

  }

  updateMetadata = function (metadata, path = '') {
        
    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		
    return bsl.updateMetadata(metadata, path);

  }

  updateSnippets = function (snips, replace = false) {
        
    return bslHelper.updateSnippets(snips, replace);    

  }

  updateCustomFunctions = function (data) {
        
    return bslHelper.updateCustomFunctions(data);

  }

  setTheme = function (theme) {
        
    monaco.editor.setTheme(theme);    

  }

  setReadOnly = function (readOnly) {

    readOnlyMode = readOnly;
    editor.updateOptions({ readOnly: readOnly });

    if (contextMenuEnabled)
      editor.updateOptions({ contextmenu: !readOnly });
    
  }

  switchLang = function () {
    engLang = !engLang;
  }

  addComment = function () {
    
    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		
    bsl.addComment();

  }

  removeComment = function () {
    
    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		
    bsl.removeComment();
    
  }

  markError = function (line, column) {
    reserMark();
    let count = 12;
    err_tid = setInterval(function() {
      let newDecor = [];
      if (!decorations.length) {
        newDecor = [            
          { range: new monaco.Range(line,1,line), options: { isWholeLine: true, inlineClassName: 'error-string' }},
          { range: new monaco.Range(line,1,line), options: { isWholeLine: true, linesDecorationsClassName: 'error-mark' }},
        ];
      }
      decorations = editor.deltaDecorations(decorations, newDecor);
      count--;
      if (count == 0) {
        clearInterval(err_tid);
      }
    }, 300);
    editor.revealLineInCenter(line);
    editor.setPosition(new monaco.Position(line, column));
  }

  findText = function (string) {
    let bsl = new bslHelper(editor.getModel(), editor.getPosition());
    return bsl.findText(string);
  }

  initContextMenuActions = function() {

    contextActions.forEach(action => {
      action.dispose();
    });

    const actions = getActions(version1C);

    for (const [action_id, action] of Object.entries(actions)) {
      
      let menuAction = editor.addAction({
        id: action_id,
        label: action.label,
        keybindings: [action.key, action.cmd],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: action.order,
        run: action.callback
      });      

      contextActions.push(menuAction)
    }

  }

  init = function(version) {

    version1C = version;
    initContextMenuActions();

  }

  enableQuickSuggestions = function (enabled) {

    editor.updateOptions({ quickSuggestions: enabled });

  }

  minimap = function (enabled) {

    editor.updateOptions({ minimap: { enabled: enabled } });
    
  }

  enableModificationEvent = function (enabled) {

    generateModificationEvent = enabled;

  }

  addContextMenuItem = function(label, eventName) {

    let time = new Date().getTime();
    let id = time.toString() + '.' + Math.random().toString(36).substring(8);
    editor.addAction({
      id: id + "_bsl",
      label: label,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: time,
      run: function () {     
          sendEvent(eventName, "");
          return null;
      }
    });

  }

  switchLanguageMode = function(mode) {

    let queryPostfix = '-query';
    let currentTheme = editor._themeService.getTheme().themeName;

    if ((queryMode || DCSMode) && currentTheme.indexOf(queryPostfix) == -1)
      currentTheme += queryPostfix;
    else if (!queryMode && !DCSMode && currentTheme.indexOf(queryPostfix) >= 0)
      currentTheme = currentTheme.replace(queryPostfix, '');

    if (queryMode && mode == 'query')
      monaco.editor.setModelLanguage(editor.getModel(), "bsl_query");
    else if (DCSMode && mode == 'dcs')
      monaco.editor.setModelLanguage(editor.getModel(), "dcs_query");
    else if (queryMode)
      monaco.editor.setModelLanguage(editor.getModel(), "bsl_query");
    else if (DCSMode)
      monaco.editor.setModelLanguage(editor.getModel(), "dcs_query");
    else
      monaco.editor.setModelLanguage(editor.getModel(), "bsl");
    
    setTheme(currentTheme);

    initContextMenuActions();

  }

  switchQueryMode = function() {
    
    queryMode = !queryMode;
    switchLanguageMode('query');

  }

  switchDCSMode = function() {

    DCSMode = !DCSMode;
    switchLanguageMode('dcs');

  }

  switchXMLMode = function() {
    
    let identifier = editor.getModel().getLanguageIdentifier();
    let language_id = 'xml';

    if (identifier.language == 'xml') {
      language_id = queryMode ? 'bsl_query' : 'bsl';
    }

    monaco.editor.setModelLanguage(editor.getModel(), language_id);
      
  }

  getSelectedText = function() {

    return editor.getModel().getValueInRange(editor.getSelection());

  }

  addWordWrap = function () {
    
    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		
    bsl.addWordWrap();

  }

  removeWordWrap = function () {
    
    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		
    bsl.removeWordWrap();
    
  }

  setCustomHovers = function (variables) {
        
    try {
			customHovers = JSON.parse(variables);			
			return true;
		}
		catch (e) {
			return { errorDescription: e.message };
		}

  }

  getVarsNames = function () {
    
    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		
    return bsl.getVarsNames(0);    
    
  }

  getSelection = function() {

    return editor.getSelection();

  }

  setSelection = function(startLineNumber, startColumn, endLineNumber, endColumn) {
    
    if (endLineNumber <= getLineCount()) {
      let range = new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn);
      editor.setSelection(range);
      editor.revealLineInCenterIfOutsideViewport(startLineNumber);
      return true;
    }
    else
      return false;

  }

  setSelectionByLength = function(start, end) {
    
    let startPosition = editor.getModel().getPositionAt(start - 1);
    let endPosition = editor.getModel().getPositionAt(end - 1);
    let range = new monaco.Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column);    
    editor.setSelection(range);
    return true;

  }

  selectedText = function(text) {

    if (!text)
      
      return getSelectedText();    

    else {      
      
      if (getSelectedText()) {

        let selection = getSelection();
        let tempModel = monaco.editor.createModel(text);
        let tempRange = tempModel.getFullModelRange();
        
        setText(text, getSelection(), false);

        if (tempRange.startLineNumber == tempRange.endLineNumber)
          setSelection(selection.startLineNumber, selection.startColumn, selection.startLineNumber, selection.startColumn + tempRange.endColumn - 1);
        else
          setSelection(selection.startLineNumber, selection.startColumn, selection.startLineNumber + tempRange.endLineNumber - tempRange.startLineNumber, tempRange.endColumn);          

      }
      else
        setText(text, undefined, false);

    }

  }

  getLineCount = function() {
    
    return editor.getModel().getLineCount();

  }

  getLineContent = function(lineNumber) {

    return editor.getModel().getLineContent(lineNumber)

  }

  getCurrentLineContent = function() {

    return getLineContent(editor.getPosition().lineNumber);

  }

  getCurrentLine = function() {

    return editor.getPosition().lineNumber;

  }

  getCurrentColumn = function() {

    return editor.getPosition().column;

  }

  setLineContent = function(lineNumber, text) {

    if (lineNumber <= getLineCount()) {
      let range = new monaco.Range(lineNumber, 1, lineNumber, editor.getModel().getLineMaxColumn(lineNumber));
      setText(text, range, false);
      return true;      
    }
    else {
      return false;
    }

  }

  compare = function (text, sideBySide, highlight, xml = false) {
    
    document.getElementById("container").innerHTML = ''
    let language_id = queryMode ? 'bsl_query' : 'bsl';

    let queryPostfix = '-query';
    let currentTheme = editor._themeService.getTheme().themeName;

    if (queryMode && currentTheme.indexOf(queryPostfix) == -1)
      currentTheme += queryPostfix;
    else if (!queryMode && currentTheme.indexOf(queryPostfix) >= 0)
      currentTheme = currentTheme.replace(queryPostfix, '');

    if (text) {      
      if (xml) {
        language_id = 'xml';
        currentTheme = 'vs';
      }
      let originalModel = originalText ? monaco.editor.createModel(originalText) : monaco.editor.createModel(editor.getModel().getValue());
      let modifiedModel = monaco.editor.createModel(text);
      originalText = originalModel.getValue();
      editor = monaco.editor.createDiffEditor(document.getElementById("container"), {
        theme: currentTheme,
        language: language_id,
        contextmenu: false,
        automaticLayout: true,
        renderSideBySide: sideBySide        
      });    
      if (highlight) {
        monaco.editor.setModelLanguage(originalModel, language_id);
        monaco.editor.setModelLanguage(modifiedModel, language_id);
      }
      editor.setModel({
        original: originalModel,
        modified: modifiedModel
      });
      editor.navi = monaco.editor.createDiffNavigator(editor, {
        followsCaret: true,
        ignoreCharChanges: true
      });
    }
    else
    {
      editor = monaco.editor.create(document.getElementById("container"), {
        theme: currentTheme,
        value: originalText,
        language: language_id,
        contextmenu: contextMenuEnabled,
        automaticLayout: true
      });
      originalText = '';
    }
    editor.updateOptions({ readOnly: readOnlyMode });
  }

  triggerSuggestions = function() {
    
    editor.trigger('', 'editor.action.triggerSuggest', {});

  }

  requestMetadata = function(metadata) {

    let metadata_name = metadata.toLowerCase();
    let request = metadataRequests.get(metadata_name);

    if (!request) {
      metadataRequests.set(metadata_name, true);
      sendEvent("EVENT_GET_METADATA", metadata_name);
    }

  }

  showCustomSuggestions = function(suggestions) {
    
    customSuggestions = [];
    
    try {
            
      let suggestObj = JSON.parse(suggestions);
      
      for (const [key, value] of Object.entries(suggestObj)) {

        customSuggestions.push({
          label: value.name,
          kind: monaco.languages.CompletionItemKind[value.kind],
          insertText: value.text,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: value.detail,
          documentation: value.documentation
        });

      }

      triggerSuggestions();
      return true;
      
		}
		catch (e) {
			return { errorDescription: e.message };
		}

  }

  nextDiff = function() {

    if (editor.navi)
      editor.navi.next();

  }

  previousDiff = function() {

    if (editor.navi)
      editor.navi.previous();

  }

  disableContextMenu = function() {
    
    editor.updateOptions({ contextmenu: false });
    contextMenuEnabled = false;

  }

  scrollToTop = function () {
    
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

  }

  hideLineNumbers = function() {
        
    editor.updateOptions({ lineNumbers: false, lineDecorationsWidth: 0 });

  }

  showLineNumbers = function() {
        
    editor.updateOptions({ lineNumbers: true, lineDecorationsWidth: 10 });
    
  }

  clearMetadata = function() {

    for (let [key, value] of Object.entries(bslMetadata)) {
      if (value.hasOwnProperty('items'))
        bslMetadata[key].items = {};
    }

  }

  hideScroll = function(type) {

    document.getElementsByTagName('body')[0].style[type] = 'hidden';
    document.getElementById('container').style[type] = 'hidden';

  }

  hideScrollX = function() {

    hideScroll('overflowX');

  }

  hideScrollY = function() {

    hideScroll('overflowY');

  }

  getTokenFromPosition = function(position) {

    let bsl = new bslHelper(editor.getModel(), position);
    return bsl.getLastToken();

  }

  getLastToken = function() {

    return getTokenFromPosition(editor.getPosition());

  }

  checkNewStringLine = function () {

    if (!queryMode && !DCSMode) {

      const model = editor.getModel();
      const position = editor.getPosition();
      const line = position.lineNumber;
      const length = model.getLineLength(line);
      const expression = model.getValueInRange(new monaco.Range(line, position.column, line, length + 1));
      const column = model.getLineLastNonWhitespaceColumn(line - 1);
      const char = model.getValueInRange(new monaco.Range(line - 1, column - 1, line - 1, column));
      const token = getTokenFromPosition(new monaco.Position(line - 1, column));

      if (0 <= token.indexOf('string.invalid') || 0 <= token.indexOf('query') || char == '|') {

        if (token != 'query.quotebsl' || char == '|') {

          const range = new monaco.Range(line, position.column, line, length + 2);

          let operation = {
            range: range,
            text: '|' + expression,
            forceMoveMarkers: true
          };

          editor.executeEdits('nql', [operation]);
          editor.setPosition(new monaco.Position(line, position.column + 1));

        }

      }

    }

  }

  function getSuggestWidgetRows(element) {

    let rows = [];

    for (let i = 0; i < element.parentElement.childNodes.length; i++) {              
      
      let row = element.parentElement.childNodes[i];
      
      if (row.classList.contains('monaco-list-row'))
        rows.push(row.getAttribute('aria-label'));

    }

    return rows;

  }

  genarateEventWithSuggestData = function(eventName, suggestRows, trigger, extra) {

    let bsl = new bslHelper(editor.getModel(), editor.getPosition());		

    eventParams = {
      trigger: trigger,
      current_word: bsl.word,
      last_word: bsl.lastRawExpression,
      last_expression: bsl.lastExpression,                    
      rows: suggestRows              
    }

    if (eventName == 'EVENT_ON_ACTIVATE_SUGGEST_ROW') 
      eventParams['focused'] = extra;
    else if (eventName == 'EVENT_ON_SELECT_SUGGEST_ROW') 
      eventParams['selected'] = extra;
    
    sendEvent(eventName, eventParams);

  }

  enableSuggestActivationEvent = function(enabled) {

    if (suggestObserver != null) {
      suggestObserver.disconnect();
      suggestObserver = null;
    }

    if (enabled) {

      suggestObserver = new MutationObserver(function (mutations) {        
      
        mutations.forEach(function (mutation) {      
          
          if (mutation.target.classList.contains('monaco-list-rows') && mutation.addedNodes.length) {
              
              let element = mutation.addedNodes[0];
    
              if (element.classList.contains('monaco-list-row') && element.classList.contains('focused')) {
                let rows = getSuggestWidgetRows(element);
                genarateEventWithSuggestData('EVENT_ON_ACTIVATE_SUGGEST_ROW', rows, 'focus', element.getAttribute('aria-label'));
              }
              
          }

        })
        
      });
    
      suggestObserver.observe(document, {
        childList: true,
        subtree: true,    
      });

    }

  }

  enableBeforeShowSuggestEvent = function(enabled) {
    
    generateBeforeShowSuggestEvent = enabled;

  }

  enableSelectSuggestEvent = function(enabled) {
    
    generateSelectSuggestEvent = enabled;

  }

  hideSuggestionsList = function() {

      let widget = document.querySelector('.suggest-widget');
      widget.style.display = 'hidden';
      widget.style.visibility = 'hidden';

  }

  editor = undefined;

  // Register languages
  for (const [key, lang] of Object.entries(languages)) {
  
    let language = lang.languageDef;

    monaco.languages.register({ id: language.id });

    // Register a tokens provider for the language
    monaco.languages.setMonarchTokensProvider(language.id, language.rules);

    // Register providers for the new language
    monaco.languages.registerCompletionItemProvider(language.id, lang.completionProvider);
    monaco.languages.registerFoldingRangeProvider(language.id, lang.foldingProvider);      
    monaco.languages.registerSignatureHelpProvider(language.id, lang.signatureProvider);
    monaco.languages.registerHoverProvider(language.id, lang.hoverProvider);    
    monaco.languages.registerDocumentFormattingEditProvider(language.id, lang.formatProvider);
    monaco.languages.registerCodeLensProvider(language.id, {
      provideCodeLenses: lang.codeLenses.provider, 
      resolveCodeLens: lang.codeLenses.resolver
    });

    if (!editor) {

      for (const [key, value] of Object.entries(language.themes)) {
        monaco.editor.defineTheme(value.name, value);
        monaco.editor.setTheme(value.name);
      }

      editor = monaco.editor.create(document.getElementById("container"), {
        theme: "bsl-white",
        value: getCode(),
        language: language.id,
        contextmenu: false,
        wordBasedSuggestions: false,
        customOptions: true
      });

      contextMenuEnabled = editor.getRawOptions().contextmenu;

    }

  };
  
  for (const [action_id, action] of Object.entries(permanentActions)) {
    editor.addAction({
      id: action_id,
      label: action.label,
      keybindings: [action.key, action.cmd],
      precondition: null,
      keybindingContext: null,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: action.order,
      run: action.callback
    });

  }

  editor.onDidChangeModelContent(e => {
    
    if (generateModificationEvent)
      sendEvent('EVENT_CONTENT_CHANGED', '');
      
  });

  editor.onKeyDown(e => {
    
    if (e.code == 'ArrowUp' && editor.getPosition().lineNumber == 1)    
      scrollToTop();
    else if (e.code == 'Enter' && generateSelectSuggestEvent) {      
      let element = document.querySelector('.monaco-list-row.focused');
      if (element) {
        let rows = getSuggestWidgetRows(element);
        genarateEventWithSuggestData('EVENT_ON_SELECT_SUGGEST_ROW', rows, 'selection', element.getAttribute('aria-label'));
      }
    }
    

  });

  editor.onDidScrollChange(e => {
        
    if (e.scrollTop == 0) {
      scrollToTop();
    }

  });
  
  editor.onDidType(text => {

    if (text === '\n') {
      checkNewStringLine();
    }

  });
  
});