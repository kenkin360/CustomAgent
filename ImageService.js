var ImageService=Function.extend(Object, function () {
	var _=this(ImageService);
	ImageService=_[ImageService];

	function ImageService(flow) {
		_['base'].apply(this, arguments);
		_(this).m_flow=flow;
	}
	ImageService.ModelDisplayName='🍌 Nano Banana 2.1';

	_['public'].GetDimensions=async function (image) {
		if (Number.isInteger(image?.width)&&Number.isInteger(image?.height)&&image.width>0&&image.height>0) {
			return {width: image.width, height: image.height};
		}
		let source=new Image();
		source.src=`data:${image.mimeType};base64,${image.base64}`;
		await source.decode();
		if (!source.naturalWidth||!source.naturalHeight) throw new Error('Unable to read image dimensions.');
		return {width: source.naturalWidth, height: source.naturalHeight};
	};

	_['public'].GetAspectRatio=function ({width, height}) {
		let a=width;
		let b=height;
		while (b) [a, b]=[b, a%b];
		return width/a+':'+height/a;
	};

	_['public'].ReadActionResult=async function (value, image, actionName) {
		let output=value&&typeof value==='object'&&'image' in value?value.image:value;
		if (!output||typeof output.base64!=='string'||!/^image\/(png|jpeg|webp)$/.test(output.mimeType)) return null;
		let dimensions=await this.GetDimensions(output);
		return {
			...image, kind: 'image', id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
			, base64: output.base64, mimeType: output.mimeType, mediaId: undefined
			, ...dimensions
			, prompt: `Local runtime edit: ${actionName}`
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, aspectRatio: this.GetAspectRatio(dimensions)
			, title: output.title||`${image?.title||'Image'} · ${actionName}`
		};
	};

	_['private'].GetContent=async function (media) {
		if (typeof media?.base64==='string'&&media.base64&&typeof media.mimeType==='string'&&media.mimeType) return media;
		if (!media?.mediaId) throw new Error('The image has neither content nor a mediaId.');
		let content=await this.m_flow.media.getBase64({mediaId: media.mediaId});
		if (typeof content?.base64!=='string'||!content.base64) throw new Error('Flow did not return the selected image content.');
		let mimeType=content.mimeType||media.mimeType;
		if (!mimeType) throw new Error('Flow did not return the selected image MIME type.');
		return {...media, ...content, mimeType};
	};

	_['public'].Select=async function () {
		let selected=await _(this).m_flow.media.select({filter: 'image'});
		if (!selected) return null;
		selected=await _(this).GetContent(selected);
		let dimensions=await this.GetDimensions(selected);
		return {
			id: 'img_'+Date.now()
			, base64: selected.base64
			, mimeType: selected.mimeType
			, mediaId: selected.mediaId
			, prompt: '從媒體庫匯入的原始影像'
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, aspectRatio: this.GetAspectRatio(dimensions)
			, ...dimensions
			, title: selected.name||'匯入影像'
		};
	};

	_['public'].Capture=async function () {
		let flow=_(this).m_flow;
		let photo=await flow.camera.capture({facingMode: 'user'});
		if (!photo) return null;
		let dimensions=await this.GetDimensions(photo);
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
			, aspectRatio: this.GetAspectRatio(dimensions)
			, ...dimensions
			, title: '相機拍照'
		};
	};

	_['public'].Generate=async function (prompt, image, ratio, index) {
		let flow=_(this).m_flow;
		let mediaId=image?.mediaId;
		let aspectRatio=ratio==='original'?(image?this.GetAspectRatio(await this.GetDimensions(image)):undefined):ratio;
		if (image&&!mediaId) {
			let upload=await flow.upload({base64: image.base64, mimeType: image.mimeType, name: image.title});
			mediaId=upload.mediaId;
		}
		let result=await flow.generate.image({
			prompt
			, referenceImageMediaIds: mediaId?[mediaId]:undefined
			, aspectRatio
			, modelDisplayName: ImageService.ModelDisplayName
		});
		result=await _(this).GetContent(result);
		let dimensions=await this.GetDimensions(result);
		return {
			SourceMediaId: mediaId
			, Image: {
				id: 'ver_'+Date.now()
				, base64: result.base64
				, mimeType: result.mimeType
				, mediaId: result.mediaId
				, prompt
				, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
				, aspectRatio: this.GetAspectRatio(dimensions)
				, ...dimensions
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

