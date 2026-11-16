var MediaContent=Function.extend(Object, function () {
	var _=this(MediaContent);
	MediaContent=_[MediaContent];
	function MediaContent(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_base64=value.base64;
		$this.m_mimeType=value.mimeType;
		$this.m_mediaId=value.mediaId;
	}
	for (let [name, field] of [['base64', 'm_base64'], ['mimeType', 'm_mimeType'], ['mediaId', 'm_mediaId']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_base64=null;
	_['private'].m_mimeType=null;
	_['private'].m_mediaId=null;
});

var Provenance=Function.extend(Object, function () {
	var _=this(Provenance);
	Provenance=_[Provenance];
	function Provenance(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_title=value.title;
		$this.m_prompt=value.prompt;
		$this.m_timestamp=value.timestamp;
	}
	for (let [name, field] of [['title', 'm_title'], ['prompt', 'm_prompt'], ['timestamp', 'm_timestamp']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_title=null;
	_['private'].m_prompt=null;
	_['private'].m_timestamp=null;
});

var Dimensions=Function.extend(Object, function () {
	var _=this(Dimensions);
	Dimensions=_[Dimensions];
	function Dimensions(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_width=value.width;
		$this.m_height=value.height;
		$this.m_aspectRatio=value.aspectRatio;
	}
	for (let [name, field] of [['width', 'm_width'], ['height', 'm_height'], ['aspectRatio', 'm_aspectRatio']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_width=null;
	_['private'].m_height=null;
	_['private'].m_aspectRatio=null;
});

var VideoDetails=Function.extend(Object, function () {
	var _=this(VideoDetails);
	VideoDetails=_[VideoDetails];
	function VideoDetails(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_durationSeconds=value.durationSeconds;
		$this.m_resolution=value.resolution;
		$this.m_modelDisplayName=value.modelDisplayName;
	}
	for (let [name, field] of [['durationSeconds', 'm_durationSeconds'], ['resolution', 'm_resolution'], ['modelDisplayName', 'm_modelDisplayName']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_durationSeconds=null;
	_['private'].m_resolution=null;
	_['private'].m_modelDisplayName=null;
});

var Artifact=Function.extend(Object, function () {
	var _=this(Artifact);
	Artifact=_[Artifact];
	function Artifact(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_kind=value.kind;
		$this.m_id=value.id;
		$this.m_content=new MediaContent(value);
		$this.m_provenance=new Provenance(value);
	}
	Artifact.From=function (value) {
		if (!value||value instanceof Artifact) return value;
		if (value.kind==='image') return new ImageArtifact(value);
		if (value.kind==='video') return new VideoArtifact(value);
		return new Artifact(value);
	};
	for (let [name, field] of [['kind', 'm_kind'], ['id', 'm_id']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	for (let [name, owner, field] of [['base64', 'm_content', 'base64'], ['mimeType', 'm_content', 'mimeType'], ['mediaId', 'm_content', 'mediaId'], ['title', 'm_provenance', 'title'], ['prompt', 'm_provenance', 'prompt'], ['timestamp', 'm_provenance', 'timestamp']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[owner][field]; }});
	}
	_['public'].ToJSON=function () {
		let {kind, id, base64, mimeType, mediaId, title, prompt, timestamp}=this;
		return {kind, id, base64, mimeType, mediaId, title, prompt, timestamp};
	};
	_['public'].toJSON=function () { return this.ToJSON(); };
	_['private'].m_kind=null;
	_['private'].m_id=null;
	_['private'].m_content=null;
	_['private'].m_provenance=null;
});

var ImageArtifact=Function.extend(Artifact, function () {
	var _=this(ImageArtifact);
	ImageArtifact=_[ImageArtifact];
	function ImageArtifact(value={}) {
		let data=value instanceof Artifact?value.ToJSON():value;
		_['base'].call(this, {...data, kind: 'image'});
		_(this).m_dimensions=new Dimensions(data);
	}
	for (let name of ['width', 'height', 'aspectRatio']) {
		Object.defineProperty(_['public'], name, {get() { return _(this).m_dimensions[name]; }});
	}
	_['public'].ToJSON=function () { return {...Artifact.prototype.ToJSON.call(this), width: this.width, height: this.height, aspectRatio: this.aspectRatio}; };
	_['private'].m_dimensions=null;
});

var VideoArtifact=Function.extend(Artifact, function () {
	var _=this(VideoArtifact);
	VideoArtifact=_[VideoArtifact];
	function VideoArtifact(value={}) {
		let data=value instanceof Artifact?value.ToJSON():value;
		_['base'].call(this, {...data, kind: 'video'});
		_(this).m_details=new VideoDetails(data);
	}
	for (let name of ['durationSeconds', 'resolution', 'modelDisplayName']) {
		Object.defineProperty(_['public'], name, {get() { return _(this).m_details[name]; }});
	}
	_['public'].ToJSON=function () { return {...Artifact.prototype.ToJSON.call(this), durationSeconds: this.durationSeconds, resolution: this.resolution, modelDisplayName: this.modelDisplayName}; };
	_['private'].m_details=null;
});

var MessageContent=Function.extend(Object, function () {
	var _=this(MessageContent);
	MessageContent=_[MessageContent];
	function MessageContent(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_includedImage=value.includedImage?new ImageArtifact(value.includedImage):undefined;
		$this.m_includedArtifact=Artifact.From(value.includedArtifact);
		$this.m_suggestedPrompt=value.suggestedPrompt;
		$this.m_aspectRatio=value.aspectRatio;
		$this.m_accumulatedChanges=value.accumulatedChanges?.slice();
	}
	for (let [name, field] of [['includedImage', 'm_includedImage'], ['includedArtifact', 'm_includedArtifact'], ['suggestedPrompt', 'm_suggestedPrompt'], ['aspectRatio', 'm_aspectRatio'], ['accumulatedChanges', 'm_accumulatedChanges']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_includedImage=null;
	_['private'].m_includedArtifact=null;
	_['private'].m_suggestedPrompt=null;
	_['private'].m_aspectRatio=null;
	_['private'].m_accumulatedChanges=null;
});

var Message=Function.extend(Object, function () {
	var _=this(Message);
	Message=_[Message];
	function Message(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_id=value.id;
		$this.m_sender=value.sender;
		$this.m_text=value.text;
		$this.m_timestamp=value.timestamp;
		$this.m_content=new MessageContent(value);
	}
	for (let [name, field] of [['id', 'm_id'], ['sender', 'm_sender'], ['text', 'm_text'], ['timestamp', 'm_timestamp']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	for (let name of ['includedImage', 'includedArtifact', 'suggestedPrompt', 'aspectRatio', 'accumulatedChanges']) {
		Object.defineProperty(_['public'], name, {get() { return _(this).m_content[name]; }});
	}
	_['public'].toJSON=function () {
		let {id, sender, text, timestamp, includedImage, includedArtifact, suggestedPrompt, aspectRatio, accumulatedChanges}=this;
		return {id, sender, text, timestamp, includedImage, includedArtifact, suggestedPrompt, aspectRatio, accumulatedChanges};
	};
	_['private'].m_id=null;
	_['private'].m_sender=null;
	_['private'].m_text=null;
	_['private'].m_timestamp=null;
	_['private'].m_content=null;
});

var MediaState=Function.extend(Object, function () {
	var _=this(MediaState);
	MediaState=_[MediaState];
	function MediaState() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_activeImage=null;
		$this.m_currentArtifact=null;
		$this.m_history=[];
		$this.m_isGenerating=false;
	}
	for (let [name, field, convert] of [
		['activeImage', 'm_activeImage', (value)=>value?value instanceof ImageArtifact?value:new ImageArtifact(value):null]
		, ['currentArtifact', 'm_currentArtifact', Artifact.From]
		, ['history', 'm_history', (value)=>value.map((image)=>image instanceof ImageArtifact?image:new ImageArtifact(image))]
		, ['isGenerating', 'm_isGenerating', (value)=>value]
	]) Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }, set(value) { _(this)[field]=convert(value); }});
	_['private'].m_activeImage=null;
	_['private'].m_currentArtifact=null;
	_['private'].m_history=null;
	_['private'].m_isGenerating=null;
});

var DraftState=Function.extend(Object, function () {
	var _=this(DraftState);
	DraftState=_[DraftState];
	function DraftState() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_selectedRatio='original';
		$this.m_accumulatedChanges=[];
		$this.m_generationPrompt='';
	}
	for (let [name, field, convert] of [['selectedRatio', 'm_selectedRatio', (value)=>value], ['generationPrompt', 'm_generationPrompt', (value)=>value], ['accumulatedChanges', 'm_accumulatedChanges', (value)=>value.filter((item)=>typeof item==='string')]]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }, set(value) { _(this)[field]=convert(value); }});
	}
	_['private'].m_selectedRatio=null;
	_['private'].m_accumulatedChanges=null;
	_['private'].m_generationPrompt=null;
});

var ChatState=Function.extend(Object, function () {
	var _=this(ChatState);
	ChatState=_[ChatState];
	function ChatState() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_messages=[];
		$this.m_inputText='';
		$this.m_isConsulting=false;
	}
	for (let [name, field, convert] of [['messages', 'm_messages', (value)=>value.map((entry)=>entry instanceof Message?entry:new Message(entry))], ['inputText', 'm_inputText', (value)=>value], ['isConsulting', 'm_isConsulting', (value)=>value]]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }, set(value) { _(this)[field]=convert(value); }});
	}
	_['private'].m_messages=null;
	_['private'].m_inputText=null;
	_['private'].m_isConsulting=null;
});

var AgentState=Function.extend(Object, function () {
	var _=this(AgentState);
	AgentState=_[AgentState];
	function AgentState() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_media=new MediaState();
		$this.m_draft=new DraftState();
		$this.m_chat=new ChatState();
	}
	for (let [owner, names] of [['m_media', ['activeImage', 'currentArtifact', 'history', 'isGenerating']], ['m_draft', ['selectedRatio', 'accumulatedChanges', 'generationPrompt']], ['m_chat', ['messages', 'inputText', 'isConsulting']]]) {
		for (let name of names) Object.defineProperty(_['public'], name, {get() { return _(this)[owner][name]; }, set(value) { _(this)[owner][name]=value; }});
	}
	_['public'].ToSnapshot=function () {
		let {activeImage, currentArtifact, history, isGenerating, selectedRatio, accumulatedChanges, generationPrompt, messages, inputText, isConsulting}=this;
		return {activeImage, currentArtifact, history: [...history], isGenerating, selectedRatio, accumulatedChanges: [...accumulatedChanges], generationPrompt, messages: [...messages], inputText, isConsulting};
	};
	_['private'].m_media=null;
	_['private'].m_draft=null;
	_['private'].m_chat=null;
});
