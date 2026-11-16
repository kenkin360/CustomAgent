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
		if (state.history!==$this.m_lastHistory||area!==$this.m_lastNode) {
			area.replaceChildren(...state.history.map((image)=>{
				let button=document.createElement('button');
				button.dataset.version=image.id;
				button.title=image.title;
				button.onclick=()=>select(image.id);
				let thumbnail=document.createElement('img');
				thumbnail.src=`data:${image.mimeType};base64,${image.base64}`;
				thumbnail.alt=image.title;
				button.appendChild(thumbnail);
				return button;
			}));
			$this.m_lastHistory=state.history;
			$this.m_lastNode=area;
		}
		for (let button of area.children) button.classList.toggle('ca-selected', button.dataset.version===state.activeImage?.id);
	};
	_['private'].m_lastHistory=null;
	_['private'].m_lastNode=null;
});
