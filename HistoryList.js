var HistoryList=Function.extend(Object, function () {
	var _=this(HistoryList);
	HistoryList=_[HistoryList];

	function HistoryList() {
		_['base'].apply(this, arguments);
	}

	_['private'].CreateThumbnailButton=function (media, pick, url) {
		let button=document.createElement('button');
		button.dataset.version=media.Id;
		button.title=media.Title||'Media';

		button.onclick=function(){
			pick(media.Id);
		};

		return button;
	};

	_['private'].CreateImageButton=function (media, pick, url) {
		let thumbnail=document.createElement('img');
		let button=_(this).CreateThumbnailButton(media, pick, url);		

		thumbnail.src=url(media);
		thumbnail.alt=button.title;
		button.appendChild(thumbnail);
		return button;
	};

	_['private'].CreateVideoButton=function (media, pick, url) {
		let thumbnail=document.createElement('video');
		let button=_(this).CreateThumbnailButton(media, pick, url);		

		thumbnail.muted=true;
		thumbnail.playsInline=true;
		thumbnail.preload='metadata';

		thumbnail.onloadedmetadata=()=>{
			if (thumbnail.duration>0.1) {
				thumbnail.currentTime=0.1;
			}
		};

		thumbnail.src=url(media);
		// thumbnail.alt=button.title;
		button.appendChild(thumbnail);
		return button;
	};

	_['public'].Update=function (area, state, pick, url) {
		let $this=_(this);

		if (!area) { 
			$this.m_lastNode=null; 
			return; 
		}

		if ((state.History!==$this.m_lastHistory)||(area!==$this.m_lastNode)) {
			area.replaceChildren(...state.History.map(media=>{
				if(media instanceof Media.Image){
					return $this.CreateImageButton(media, pick, url);
				}
				else if(media instanceof Media.Video){
					return $this.CreateVideoButton(media, pick, url);
				}
				else {
					let button=$this.CreateThumbnailButton(media, pick, url);
					button.textContent=media.MimeType;
					return button;					
				}
			}));

			$this.m_lastNode=area;
			$this.m_lastHistory=state.History;			
		}

		for (let button of area.children) {
			button.classList.toggle('ca-selected', button.dataset.version===state.ActiveMedia?.Id);		
		}
	};

	_['private'].m_lastNode=null;
	_['private'].m_lastHistory=null;	
});
