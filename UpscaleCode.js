var UpscaleCode=Function.extend(Object, function () {
	var _=this(UpscaleCode);
	UpscaleCode=_[UpscaleCode];

	function UpscaleCode() {
		_['base'].apply(this, arguments);
	}

	UpscaleCode.Code=String.raw`
export default function(runtime) {
	var Upscale=Function.extend(Object, function () {
		var _=this(Upscale);
		Upscale=_[Upscale];

		function Upscale() {
			_['base'].apply(this, arguments);
			let $this=_(this);
			$this.m_module=import('https://esm.sh/@websr/websr@0.1.1?standalone').then(
		value=>({Type: value.default})
		, error=>({Error: error})
	);
			$this.m_weights=null;
		}

		_['private'].GetWeights=async function () {
			let $this=_(this);
			if (!$this.m_weights) {
				$this.m_weights=fetch('https://esm.sh/gh/sb2702/websr@v0.1.0/weights/realesrgan/x4v3.bin?raw').then(async function(response) {
				if (!response.ok) {
					throw new Error('Failed to load weights: '+response.status);
				}
				return response.arrayBuffer();
				});
			}
			try { return await $this.m_weights; }
			catch (error) { $this.m_weights=null; throw error; }
		};

		_['public'].Run=async function(args, {image}) {
		if (!image) {
			throw new Error('Load an image first.');
		}
		const loaded=await _(this).m_module;
		if (loaded.Error) {
			throw loaded.Error;
		}
		const WebSR=loaded.Type;
		const source=new Image();
		source.src='data:'+image.mimeType+';base64,'+image.base64;
		await source.decode();
		const buffer=await _(this).GetWeights();
		const canvas=document.createElement('canvas');
		let upscaler;
		let webgl=false;
		let gpu=false;
		try {
			gpu=await WebSR.initWebGPU();
		}
		catch (error) {
			gpu=false;
		}
		if (gpu) {
			upscaler=new WebSR({
				network_name: 'realesrgan/x4v3'
				, weights: WebSR.parseBinaryWeights(buffer)
				, gpu
				, canvas
			});
		}
		else {
			const {default: WebSRWebGL}=await import('https://esm.sh/@websr/webgl@0.1.0?standalone');
			const gl=WebSRWebGL.initWebGL(canvas);
			if (!gl||!WebSRWebGL.supportsNetwork('realesrgan/x4v3', gl)) {
				throw new Error('Real-ESRGAN requires WebGPU or a capable WebGL2 device.');
			}
			webgl=true;
			upscaler=new WebSRWebGL({
				network_name: 'realesrgan/x4v3'
				, weights: WebSRWebGL.parseBinaryWeights(buffer)
				, gl
				, canvas
			});
		}
		try {
			await upscaler.render(source);
			const output=document.createElement('canvas');
			output.width=canvas.width;
			output.height=canvas.height;
			const context=output.getContext('2d');
			if (!context) {
				throw new Error('Output canvas is unavailable.');
			}
			if (webgl) {
				const pixels=upscaler.readPixels();
				const result=context.createImageData(output.width, output.height);
				const row=output.width*4;
				for (let y=0; y<output.height; y++) {
					result.data.set(pixels.subarray(y*row, (y+1)*row), (output.height-1-y)*row);
				}
				context.putImageData(result, 0, 0);
			}
			else {
				context.drawImage(canvas, 0, 0);
			}
			return {
				message: 'Upscaled to '+output.width+' × '+output.height+' with Real-ESRGAN.'
				, image: {
					base64: output.toDataURL('image/png').split(',')[1]
					, mimeType: 'image/png'
					, title: image.title+' · 4x'
				}
			};
		}
		finally {
			upscaler.destroy();
		}
		};
		_['private'].m_module=null;
		_['private'].m_weights=null;
	});
	let upscale=new Upscale();
	runtime.upscaleImage=upscale.Run.bind(upscale);
}
`;
});

