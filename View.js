var View=Function.extend(Object, function () {
	var _=this(View);
	View=_[View];
	function View() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_root=null;
		$this.m_urls=new Map();
		$this.m_mounted=new Map();
		$this.m_messages=new MessageList();
		$this.m_history=new HistoryList();
		$this.m_locale=(navigator.languages||[]).find((language)=>/^zh\b/i.test(language))?'zh':/^zh\b/i.test(navigator.language||'')?'zh':'en';
	}

	_['public'].SetRoot=function (element) { _(this).m_root=element; };

	_['public'].GetRoot=function () { return _(this).m_root; };

	_['public'].Url=function (media) {
		if (!media?.Data) { return ''; }

		let urls=_(this).m_urls;
		if (!urls.has(media)) { urls.set(media, URL.createObjectURL(media.Data)); }

		return urls.get(media);
	};

	_['public'].Dispose=function () {
		let movie=this.Node('video');
		if (movie) { movie.pause(); movie.removeAttribute('src'); movie.load(); }

		for (let url of _(this).m_urls.values()) URL.revokeObjectURL(url);
		_(this).m_urls.clear();
	};

	_['public'].Prune=function (state) {
		let used=new Set([state.ActiveMedia, state.CurrentMedia, ...state.History, ...state.Messages.map((message)=>message.IncludedMedia)]);
		for (let [media, url] of _(this).m_urls) if (!used.has(media)) {
			URL.revokeObjectURL(url);
			_(this).m_urls.delete(media);
		}
	};

	_['public'].GetLocale=function () { return _(this).m_locale; };

	_['public'].Node=function (role) { return _(this).m_root?.querySelector(`[data-role="${role}"]`); };

	_['public'].Localize=function (text) {
		let root=_(this).m_root;
		if (!root) { return; }

		for (let node of root.querySelectorAll('[data-i18n]')) node.textContent=text(node.dataset.i18n);
		for (let node of root.querySelectorAll('[data-i18n-placeholder]')) node.placeholder=text(node.dataset.i18nPlaceholder);
	};

	_['public'].Mount=function (name, element, slot, slots) {
		let target=_(this).m_root?.querySelector(`[data-slot="${slot}"]`);
		if (!name||!(element instanceof HTMLElement)||!slots.includes(slot)||!target) { return Helper.Error('Provide an extension name, an HTML element, and an available UI slot.'); }

		this.Unmount(name);
		_(this).m_mounted.set(name, element);
		target.appendChild(element);
	};

	_['public'].Unmount=function (name) {
		let mounted=_(this).m_mounted;
		mounted.get(name)?.remove();
		mounted.delete(name);
	};

	_['public'].Mounted=function () { return [..._(this).m_mounted.keys()]; };

	_['private'].UpdateImage=function (media) {
		let picture=new HtmlNode(this.Node('image'));
		let image=picture.GetElement();
		if (media instanceof Media.Image&&media.Data) {
			let url=this.Url(media);
			if (image.src!==url) { picture.SetSource(url); }

			picture.Show(true);
			return media.Width&&media.Height?`${media.Width} × ${media.Height}`:'';
		}

		image.removeAttribute('src');
		picture.Show(false);
		return null;
	};

	_['private'].UpdateVideo=function (media) {
		let video=new HtmlNode(this.Node('video'));
		let movie=video.GetElement();
		if (media instanceof Media.Video&&media.Data) {
			let url=this.Url(media);
			if (movie.src!==url) { movie.src=url; }

			video.Show(true);
			return `${media.DurationSeconds||'?'} s`;
		}

		if (movie.hasAttribute('src')) {
			movie.pause();
			movie.removeAttribute('src');
			movie.load();
		}

		video.Show(false);
		return null;
	};

	_['public'].Update=function (state, text, select) {
		let root=_(this).m_root;
		if (!root) { return; }

		let node=(role)=>new HtmlNode(this.Node(role));
		let imageText=_(this).UpdateImage(state.ActiveMedia);
		let videoText=_(this).UpdateVideo(state.ActiveMedia);
		node('empty').SetStyle('display', imageText===null&&videoText===null?'block':'none');
		node('image-ratio').SetText(imageText??videoText??'');
		node('generating').SetStyle('display', state.IsGenerating?'flex':'none');
		this.Localize(text);
		new HtmlNode(root.querySelector('[data-action="send"]')).SetText(state.IsConsulting?text('stop'):text('send'));
		let input=node('input');
		if (input.GetElement()?.value!==state.InputText) { input.SetValue(state.InputText); }

		node('pending').SetStyle('display', state.AccumulatedChanges.length?'block':'none');
		node('pending-count').SetText(`${text('confirmedChanges')} (${state.AccumulatedChanges.length})`);
		node('pending-list').SetText(state.AccumulatedChanges.map((item, index)=>`${index+1}. ${item}`).join('\n'));
		node('pending-list').SetStyle('whiteSpace', 'pre-wrap');
		node('pending-prompt').SetText(state.GenerationPrompt||'');
		let ratios=node('ratios').GetElement();
		for (let button of ratios?.querySelectorAll('[data-ratio]')||[]) button.classList.toggle('ca-selected', button.dataset.ratio===state.SelectedRatio);
		_(this).m_messages.Update(node('message-list').GetElement(), state, text, (value)=>this.Url(value));
		_(this).m_history.Update(node('history').GetElement(), state, select, (value)=>this.Url(value));
		node('history-count').SetText(state.History.length);
		this.Prune(state);
	};

	_['private'].m_root=null;
	_['private'].m_urls=null;
	_['private'].m_mounted=null;
	_['private'].m_messages=null;
	_['private'].m_history=null;
	_['private'].m_locale=null;
});
