import './Function.extend.js';
import { Resource } from './Resource.js';

var Bundle=Function.extend(Function, function () {
	var _=this(Bundle);
	Bundle=_[Bundle];

	function Bundle() {
		_['base'].apply(this, arguments);
	}

	Bundle.Load=async function (onProgress) {
		let loaded={};
		let total=Bundle.Config.length;
		let completed=0;
		for (let i=total; i-->0; ) {
			let [key, url]=Bundle.Config[i];
			let progress={Key: key, File: url.split(/[?#]/)[0].split('/').pop(), Completed: completed, Total: total, Value: null, Error: null};
			onProgress?.(progress);
			try {
				let value=await new Resource.Module(key, url);
				loaded[key]=value;
				completed++;
				onProgress?.({...progress, Completed: completed, Value: value});
			}
			catch (error) {
				onProgress?.({...progress, Error: error});
				throw error;
			}
		}
		return loaded;
	};

	Bundle.CustomAgent=function (path) {
		return `https://esm.sh/gh/kenkin360/CustomAgent/${path}?raw`;
	};

	Bundle.Config=[
		['CustomAgent', Bundle.CustomAgent('CustomAgent.js')]
		, ['Assistant', Bundle.CustomAgent('Assistant.js')]
		, ['ImageService', Bundle.CustomAgent('ImageService.js')]
		, ['DrawingCode', Bundle.CustomAgent('DrawingCode.js')]
		, ['agentTemplate', Bundle.CustomAgent('views/agent.html.js')]
		, ['UpscaleCode', Bundle.CustomAgent('UpscaleCode.js')]
	];
});

export { Bundle };
