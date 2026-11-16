var VideoService=Function.extend(Object, function () {
	var _=this(VideoService);
	VideoService=_[VideoService];

	function VideoService(flow) {
		_['base'].apply(this, arguments);
		_(this).m_flow=flow;
	}
	VideoService.ModelDisplayName='Omni 1.2 Flash';

	_['private'].ResolveImageId=async function (image) {
		if (typeof image==='string'&&image) return image;
		if (typeof image?.mediaId==='string'&&image.mediaId) return image.mediaId;
		if (typeof image?.base64!=='string'||!image.base64||!/^image\//.test(image.mimeType)) {
			throw new Error('A reference image needs a mediaId or image base64 and MIME type.');
		}
		let upload=await this.m_flow.upload({base64: image.base64, mimeType: image.mimeType, name: image.title||'Video reference image'});
		if (!upload?.mediaId) throw new Error('Flow did not return an image mediaId.');
		return upload.mediaId;
	};

	_['public'].Generate=async function (options={}) {
		let {prompt, firstFrameImage, referenceImages, sourceVideoMediaId, aspectRatio='16:9', durationSeconds=5, resolution='720p'}=options;
		if (typeof prompt!=='string'||!prompt.trim()) throw new Error('Provide a video prompt.');
		if (!['16:9', '9:16'].includes(aspectRatio)) throw new Error('Unsupported video aspect ratio.');
		if (!Number.isInteger(durationSeconds)||durationSeconds<3||durationSeconds>15) throw new Error('Video duration must be 3 to 15 seconds.');
		if (!['720p', '360p'].includes(resolution)) throw new Error('Unsupported video resolution.');
		if (firstFrameImage&&referenceImages?.length) throw new Error('A first frame and reference images cannot be used together.');
		if (firstFrameImage&&sourceVideoMediaId) throw new Error('A first frame and source video cannot be used together.');
		if (sourceVideoMediaId!==undefined&&(typeof sourceVideoMediaId!=='string'||!sourceVideoMediaId)) throw new Error('The source video needs a mediaId.');
		if (referenceImages!==undefined&&(!Array.isArray(referenceImages)||referenceImages.length>10)) throw new Error('Provide up to 10 reference images.');

		let firstFrameImageMediaId=firstFrameImage?await _(this).ResolveImageId(firstFrameImage):undefined;
		let referenceImageMediaIds=referenceImages?.length?await Promise.all(referenceImages.map((image)=>_(this).ResolveImageId(image))):undefined;
		let result=await _(this).m_flow.generate.video({
			prompt: prompt.trim()
			, modelDisplayName: VideoService.ModelDisplayName
			, aspectRatio
			, durationSeconds
			, resolution
			, ...(firstFrameImageMediaId?{firstFrameImageMediaId}:{})
			, ...(referenceImageMediaIds?{referenceImageMediaIds}:{})
			, ...(sourceVideoMediaId?{sourceVideoMediaId}:{})
		});
		if (typeof result?.mediaId!=='string'||!result.mediaId) throw new Error('Flow did not return a saved video mediaId.');
		return {
			kind: 'video'
			, id: `video_${Date.now()}_${Math.random().toString(36).slice(2)}`
			, mediaId: result.mediaId
			, mimeType: result.mimeType
			, ...(typeof result.base64==='string'?{base64: result.base64}:{})
			, prompt: prompt.trim()
			, title: result.name||'Generated video'
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, aspectRatio
			, durationSeconds
			, resolution
			, modelDisplayName: VideoService.ModelDisplayName
		};
	};

	_['private'].m_flow=null;
});
