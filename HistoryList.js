var HistoryList=Function.extend(Object, function () {
	var _=this(HistoryList);
	HistoryList=_[HistoryList];
	function HistoryList() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_lastHistory=null;
		$this.m_lastNode=null;
	}
	_['public'].Update=function (area, state, select) {
		let $this=_(this);
		if (!area) { $this.m_lastNode=null; return; }
		if (state.History!==$this.m_lastHistory||area!==$this.m_lastNode) {
			area.replaceChildren(...state.History.map((image)=>{
				let button=document.createElement('button');
				button.dataset.version=image.Id;
				button.title=image.Provenance.Title;
				button.onclick=()=>select(image.Id);
				let thumbnail=document.createElement('img');
				thumbnail.src=`data:${image.Content.MimeType};base64,${image.Content.Base64}`;
				thumbnail.alt=image.Provenance.Title;
				button.appendChild(thumbnail);
				return button;
			}));
			$this.m_lastHistory=state.History;
			$this.m_lastNode=area;
		}
		for (let button of area.children) button.classList.toggle('ca-selected', button.dataset.version===state.ActiveImage?.Id);
	};
	_['private'].m_lastHistory=null;
	_['private'].m_lastNode=null;
});
