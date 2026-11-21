var ImageService=Function.extend(Object, function () {
	var _=this(ImageService);
	ImageService=_[ImageService];

	function ImageService() {
		_['base'].apply(this, arguments);
	}

	ImageService.ModelDisplayName='🍌 Nano Banana 2.1';

	_['public'].GetDimensions=async function (image) {
		if (Number.isInteger(image?.Width)&&Number.isInteger(image?.Height)&&image.Width>0&&image.Height>0) {
			return {width: image.Width, height: image.Height};
		}

		if (!image?.Data) { return Helper.Error('Image content is unavailable.'); }

		let source=new Image();
		let url=URL.createObjectURL(image.Data);
		try {
			source.src=url;
			await source.decode();
			if (!source.naturalWidth||!source.naturalHeight) { return Helper.Error('Unable to read image dimensions.'); }

			return {width: source.naturalWidth, height: source.naturalHeight};
		}
		finally {
			URL.revokeObjectURL(url);
		}
	};

	_['public'].GetAspectRatio=function ({width, height}) {
		let a=width;
		let b=height;
		while (b) [a, b]=[b, a%b];
		return width/a+':'+height/a;
	};

	_['private'].GetContent=async function (media) {
		if ('string'===typeof media?.base64&&media.base64&&'string'===typeof media.mimeType&&media.mimeType) { return media; }

		if (!media?.mediaId) { return Helper.Error('The image has neither content nor a mediaId.'); }

		let content=await Flow.media.getBase64({mediaId: media.mediaId});
		if ('string'!==typeof content?.base64||!content.base64) { return Helper.Error('Flow did not return the selected image content.'); }

		let mimeType=content.mimeType||media.mimeType;
		if (!mimeType) { return Helper.Error('Flow did not return the selected image MIME type.'); }

		return {...media, ...content, mimeType};
	};

	_['public'].Select=async function () {
		let selected=await Flow.media.select({filter: 'image'});
		if (!selected) { return null; }

		selected=await _(this).GetContent(selected);
		if (selected instanceof Error) { return selected; }

		let image=new Media.Image({
			id: 'img_'+Date.now()
			, ...selected
			, title: selected.name||'Imported image'
		});

		let dimensions=await this.GetDimensions(image);
		if (dimensions instanceof Error) { return dimensions; }

		image.Width=dimensions.width;
		image.Height=dimensions.height;
		return image;
	};

	_['public'].Capture=async function () {
		let photo=await Flow.camera.capture({facingMode: 'user'});
		if (!photo) { return null; }

		let upload=await Flow.upload({
			base64: photo.base64
			, mimeType: 'image/png'
			, name: 'Camera Capture '+new Date().toLocaleTimeString()
		});

		let image=new Media.Image({
			id: 'cam_'+Date.now()
			, base64: photo.base64
			, mimeType: photo.mimeType||'image/png'
			, mediaId: upload.mediaId
			, title: 'Camera capture'
		});

		let dimensions=await this.GetDimensions(image);
		if (dimensions instanceof Error) { return dimensions; }

		image.Width=dimensions.width;
		image.Height=dimensions.height;
		return image;
	};

	_['public'].Generate=async function (prompt, image, ratio, index) {
		let mediaId=image?.MediaId;
		let dimensions=image?await this.GetDimensions(image):null;
		if (dimensions instanceof Error) { return dimensions; }

		let aspectRatio=ratio;
		if ('original'===ratio) {
			aspectRatio=image?this.GetAspectRatio(dimensions):undefined;
		}

		if (image&&!mediaId) {
			let base64=await image.ToBase64();
			if (base64 instanceof Error) { return base64; }

			let upload=await Flow.upload({base64, mimeType: image.MimeType, name: image.Title});
			mediaId=upload.mediaId;
			image.MediaId=mediaId;
		}

		let response=await Flow.generate.image({
			prompt
			, referenceImageMediaIds: mediaId?[mediaId]:undefined
			, aspectRatio
			, modelDisplayName: ImageService.ModelDisplayName
		});

		response=await _(this).GetContent(response);
		if (response instanceof Error) { return response; }

		let output=new Media.Image({
			id: 'ver_'+Date.now()
			, base64: response.base64
			, mimeType: response.mimeType
			, mediaId: response.mediaId
			, title: `Version #${index}`
		});

		dimensions=await this.GetDimensions(output);
		if (dimensions instanceof Error) { return dimensions; }

		output.Width=dimensions.width;
		output.Height=dimensions.height;
		return output;
	};

	_['public'].Download=async function (image) {
		if (!image) { return Promise.resolve(); }

		return Flow.download({
			base64: await image.ToBase64()
			, mimeType: image.MimeType
			, filename: `revised_concept_${Date.now()}.${image.MimeType.includes('jpeg')||image.MimeType.includes('jpg')?'jpg':'png'}`
		});
	};

});

