import './Function.extend.js';

var ImageService=Function.extend(Object, function () {
	var _=this(ImageService);
	ImageService=_[ImageService];

	function ImageService(flow) {
		_['base'].apply(this, arguments);
		_(this).m_flow=flow;
	}
	ImageService.ModelDisplayName='🍌 Nano Banana 2.1';

	_['public'].Select=async function (ratio) {
		let selected=await _(this).m_flow.media.select({filter: 'image'});
		if (!selected) return null;
		return {
			id: 'img_'+Date.now()
			, base64: selected.base64
			, mimeType: selected.mimeType
			, mediaId: selected.mediaId
			, prompt: '從媒體庫匯入的原始影像'
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, aspectRatio: ratio
			, title: selected.name||'匯入影像'
		};
	};

	_['public'].Capture=async function (ratio) {
		let flow=_(this).m_flow;
		let photo=await flow.camera.capture({facingMode: 'user'});
		if (!photo) return null;
		let upload=await flow.upload({
			base64: photo.base64
			, mimeType: 'image/png'
			, name: 'Camera Capture '+new Date().toLocaleTimeString()
		});
		return {
			id: 'cam_'+Date.now()
			, base64: photo.base64
			, mimeType: photo.mimeType
			, mediaId: upload.mediaId
			, prompt: '相機即時拍攝'
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, aspectRatio: ratio
			, title: '相機拍照'
		};
	};

	_['public'].Generate=async function (prompt, image, ratio, index) {
		let flow=_(this).m_flow;
		let mediaId=image?.mediaId;
		if (image&&!mediaId) {
			let upload=await flow.upload({base64: image.base64, mimeType: image.mimeType, name: image.title});
			mediaId=upload.mediaId;
		}
		let result=await flow.generate.image({
			prompt
			, referenceImageMediaIds: mediaId?[mediaId]:undefined
			, aspectRatio: ratio
			, modelDisplayName: ImageService.ModelDisplayName
		});
		return {
			SourceMediaId: mediaId
			, Image: {
				id: 'ver_'+Date.now()
				, base64: result.base64
				, mimeType: result.mimeType
				, mediaId: result.mediaId
				, prompt
				, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
				, aspectRatio: ratio
				, title: `修改版本 #${index}`
			}
		};
	};

	_['public'].Download=function (image) {
		if (!image) return Promise.resolve();
		return _(this).m_flow.download({
			base64: image.base64
			, mimeType: image.mimeType||'image/png'
			, filename: `revised_concept_${Date.now()}.${image.mimeType.includes('jpeg')||image.mimeType.includes('jpg')?'jpg':'png'}`
		});
	};

	_['private'].m_flow=null;
});

export { ImageService };
