var View=Function.extend(Object, function () {
	var _=this(View);
	View=_[View];
	function View() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_ref=new ElementRef();
		$this.m_mounted=new Map();
		$this.m_messages=new MessageList();
		$this.m_history=new HistoryList();
		$this.m_locale=(navigator.languages||[]).find((language)=>/^zh\b/i.test(language))?'zh':/^zh\b/i.test(navigator.language||'')?'zh':'en';
	}
	_['public'].GetRef=function () { return _(this).m_ref; };
	_['public'].GetLocale=function () { return _(this).m_locale; };
	_['public'].Node=function (role) { return _(this).m_ref.current?.querySelector(`[data-role="${role}"]`); };
	_['public'].Localize=function (text) {
		let root=_(this).m_ref.current;
		if (!root) return;
		for (let node of root.querySelectorAll('[data-i18n]')) node.textContent=text(node.dataset.i18n);
		for (let node of root.querySelectorAll('[data-i18n-placeholder]')) node.placeholder=text(node.dataset.i18nPlaceholder);
	};
	_['public'].Mount=function (name, element, slot, slots) {
		let target=_(this).m_ref.current?.querySelector(`[data-slot="${slot}"]`);
		if (!name||!(element instanceof HTMLElement)||!slots.includes(slot)||!target) throw new Error('Provide an extension name, an HTML element, and an available UI slot.');
		this.Unmount(name);
		_(this).m_mounted.set(name, new Mount(element, slot));
		target.appendChild(element);
	};
	_['public'].Unmount=function (name) {
		let mounted=_(this).m_mounted;
		mounted.get(name)?.Element.remove();
		mounted.delete(name);
	};
	_['public'].Mounted=function () { return [..._(this).m_mounted.keys()]; };
	_['public'].Update=function (state, text, select) {
		let root=_(this).m_ref.current;
		if (!root) return;
		let media=state.Media;
		let draft=state.Draft;
		let chat=state.Chat;
		let node=(role)=>new HtmlNode(this.Node(role));
		let picture=node('image');
		let image=picture.GetElement();
		if (media.ActiveImage) {
			let url=`data:${media.ActiveImage.Content.MimeType};base64,${media.ActiveImage.Content.Base64}`;
			if (image&&image.src!==url) picture.SetSource(url);
			picture.Show(true);
		}
		else picture.Show(false);
		node('empty').SetStyle('display', media.ActiveImage?'none':'block');
		node('image-ratio').SetText(media.ActiveImage?.GetDimensions().Width&&media.ActiveImage?.GetDimensions().Height?`${media.ActiveImage.GetDimensions().Width} × ${media.ActiveImage.GetDimensions().Height}`:'');
		node('generating').SetStyle('display', media.IsGenerating?'flex':'none');
		this.Localize(text);
		new HtmlNode(root.querySelector('[data-action="send"]')).SetText(chat.IsConsulting?text('stop'):text('send'));
		let input=node('input');
		if (input.GetElement()?.value!==chat.InputText) input.SetValue(chat.InputText);
		node('pending').SetStyle('display', draft.AccumulatedChanges.length?'block':'none');
		node('pending-count').SetText(`${text('confirmedChanges')} (${draft.AccumulatedChanges.length})`);
		node('pending-list').SetText(draft.AccumulatedChanges.map((item, index)=>`${index+1}. ${item}`).join('\n'));
		node('pending-list').SetStyle('whiteSpace', 'pre-wrap');
		node('pending-prompt').SetText(draft.GenerationPrompt||'');
		let ratios=node('ratios').GetElement();
		for (let button of ratios?.querySelectorAll('[data-ratio]')||[]) button.classList.toggle('ca-selected', button.dataset.ratio===draft.SelectedRatio);
		_(this).m_messages.Update(node('message-list').GetElement(), chat, text);
		_(this).m_history.Update(node('history').GetElement(), media, select);
		node('history-count').SetText(media.History.length);
	};
	_['private'].m_ref=null;
	_['private'].m_mounted=null;
	_['private'].m_messages=null;
	_['private'].m_history=null;
	_['private'].m_locale=null;
});
