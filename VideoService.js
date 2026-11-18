var VideoService=Function.extend(Object, function () {
	var _=this(VideoService);
	VideoService=_[VideoService];

	function VideoService() {
		_['base'].apply(this, arguments);
	}

	VideoService.ModelDisplayName='Omni 1.2 Flash';

	_['private'].ResolveImageId=async function (image) {
		if ('string'===typeof image&&image) { return image; }

		if (image?.MediaId) { return image.MediaId; }

		if (!(image instanceof Media.Image)||!image.Data) {
			return Helper.Error('A reference image needs media content or a mediaId.');
		}

		let base64=await image.ToBase64();
		if (base64 instanceof Error) { return base64; }

		let upload=await Flow.upload({base64, mimeType: image.MimeType, name: image.Title||'Video reference image'});
		if (!upload?.mediaId) { return Helper.Error('Flow did not return an image mediaId.'); }

		image.MediaId=upload.mediaId;
		return image.MediaId;
	};

	_['public'].Generate=async function (options={}, context={}) {
		let image=context.image;
		if ((options.useCurrentImageAsFirstFrame||options.useCurrentImageAsReference)&&!image) { return Helper.Error('No current image is available.'); }

		if (options.useCurrentImageAsFirstFrame&&options.firstFrameImageMediaId) { return Helper.Error('Choose one first-frame image.'); }

		let references=options.referenceImageMediaIds||options.referenceImages||[];
		if (!Array.isArray(references)) { return Helper.Error('Reference image media IDs must be an array.'); }

		let {prompt, sourceVideoMediaId, aspectRatio='16:9', durationSeconds=5, resolution='720p'}=options;
		let firstFrameImage=options.useCurrentImageAsFirstFrame?image:options.firstFrameImageMediaId||options.firstFrameImage;
		let referenceImages=options.useCurrentImageAsReference?[image, ...references]:references;
		if ('string'!==typeof prompt||!prompt.trim()) { return Helper.Error('Provide a video prompt.'); }

		if (!['16:9', '9:16'].includes(aspectRatio)) { return Helper.Error('Unsupported video aspect ratio.'); }

		if (!Number.isInteger(durationSeconds)||durationSeconds<3||durationSeconds>15) { return Helper.Error('Video duration must be 3 to 15 seconds.'); }

		if (!['720p', '360p'].includes(resolution)) { return Helper.Error('Unsupported video resolution.'); }

		if (firstFrameImage&&referenceImages?.length) { return Helper.Error('A first frame and reference images cannot be used together.'); }

		if (firstFrameImage&&sourceVideoMediaId) { return Helper.Error('A first frame and source video cannot be used together.'); }

		if (undefined!==sourceVideoMediaId&&('string'!==typeof sourceVideoMediaId||!sourceVideoMediaId)) { return Helper.Error('The source video needs a mediaId.'); }

		if (undefined!==referenceImages&&(!Array.isArray(referenceImages)||referenceImages.length>10)) { return Helper.Error('Provide up to 10 reference images.'); }

		let firstFrameImageMediaId=firstFrameImage?await _(this).ResolveImageId(firstFrameImage):undefined;
		let referenceImageMediaIds=referenceImages?.length?await Promise.all(referenceImages.map((image)=>_(this).ResolveImageId(image))):undefined;
		if (firstFrameImageMediaId instanceof Error) { return firstFrameImageMediaId; }

		let referenceError=referenceImageMediaIds?.find((value)=>value instanceof Error);
		if (referenceError) { return referenceError; }

		let result=await Flow.generate.video({
			prompt: prompt.trim()
			, modelDisplayName: VideoService.ModelDisplayName
			, aspectRatio
			, durationSeconds
			, resolution
			, ...(firstFrameImageMediaId?{firstFrameImageMediaId}:{})
			, ...(referenceImageMediaIds?{referenceImageMediaIds}:{})
			, ...(sourceVideoMediaId?{sourceVideoMediaId}:{})
		});

		if ('string'!==typeof result?.mediaId||!result.mediaId) { return Helper.Error('Flow did not return a saved video mediaId.'); }

		let content='string'===typeof result.base64?result:await Flow.media.getBase64({mediaId: result.mediaId});
		if ('string'!==typeof content?.base64||!content.base64) { return Helper.Error('Flow did not return the generated video content.'); }

		return new Media.Video({
			id: `video_${Date.now()}_${Math.random().toString(36).slice(2)}`
			, mediaId: result.mediaId
			, mimeType: content.mimeType||result.mimeType
			, base64: content.base64
			, title: result.name||'Generated video'
			, durationSeconds
			, resolution
		});
	};

	_['public'].Download=async function (video) {
		if (!video) { return Promise.resolve(); }

		let extension=video.MimeType?.includes('webm')?'webm':video.MimeType?.includes('quicktime')?'mov':'mp4';
		return Flow.download({base64: await video.ToBase64(), mimeType: video.MimeType, filename: `generated_video_${Date.now()}.${extension}`});
	};

});
