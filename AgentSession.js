var AgentSession=Function.extend(Object, function () {
	var _=this(AgentSession);
	AgentSession=_[AgentSession];

	function AgentSession() {
		_['base'].apply(this, arguments);
		this.ActiveMedia=null;
		this.CurrentMedia=null;
		this.History=[];
		this.IsGenerating=false;
		this.SelectedRatio='original';
		this.AccumulatedChanges=[];
		this.GenerationPrompt='';
		this.Messages=[];
		this.InputText='';
		this.IsConsulting=false;
	}

	_['public'].Update=function (patch) {
		if ('activeMedia' in patch) {
			this.ActiveMedia=patch.activeMedia;
		}

		if ('currentMedia' in patch) {
			this.CurrentMedia=patch.currentMedia;
		}

		if ('history' in patch) {
			this.History=patch.history;
		}

		if ('media' in patch) {
			this.Add(patch.media);
		}

		if ('isGenerating' in patch) {
			this.IsGenerating=patch.isGenerating;
		}

		if ('selectedRatio' in patch) {
			this.SelectedRatio=patch.selectedRatio;
		}

		if ('accumulatedChanges' in patch) {
			this.AccumulatedChanges=patch.accumulatedChanges.filter((item)=>'string'===typeof item);
		}

		if ('generationPrompt' in patch) {
			this.GenerationPrompt=patch.generationPrompt;
		}

		if ('messages' in patch) {
			this.Messages=patch.messages;
		}

		if ('inputText' in patch) {
			this.InputText=patch.inputText;
		}

		if ('isConsulting' in patch) {
			this.IsConsulting=patch.isConsulting;
		}
	};

	_['public'].Add=function (media) {
		this.ActiveMedia=media;
		this.CurrentMedia=media;
		this.History=[media, ...this.History];
	};

	_['public'].Select=function (id) {
		let media=this.History.find((entry)=>entry.Id===id);
		if (!media) {
			return Helper.Error('Media version not found: '+id);
		}

		this.ActiveMedia=media;
		this.CurrentMedia=media;
		return media;
	};

	_['public'].Accept=async function (result) {
		if (result instanceof Error) {
			return result;
		}

		let value=result?.artifact||result?.image||result;
		if (!(value instanceof Media)&&!value?.mimeType&&!value?.MimeType) {
			return result;
		}

		if (!(value instanceof Media)&&!value.data&&!value.base64&&value.mediaId) {
			try {
				value={...value, ...await Flow.media.getBase64({mediaId: value.mediaId})};
			}
			catch (error) {
				return Helper.Error(error);
			}
		}

		let media=Media.From(value);
		if (media instanceof Error) {
			return media;
		}

		if (!media.Data) {
			return Helper.Error('Media content is unavailable.');
		}

		if (media instanceof Media.Image||media instanceof Media.Video) {
			this.Add(media);
		}
		else {
			this.CurrentMedia=media;
		}

		return result;
	};

	_['public'].ActiveMedia=null;
	_['public'].CurrentMedia=null;
	_['public'].History=null;
	_['public'].IsGenerating=null;
	_['public'].SelectedRatio=null;
	_['public'].AccumulatedChanges=null;
	_['public'].GenerationPrompt=null;
	_['public'].Messages=null;
	_['public'].InputText=null;
	_['public'].IsConsulting=null;
});
