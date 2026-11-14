var DrawingActions=Function.extend(Object, function () {
	var _=this(DrawingActions);
	DrawingActions=_[DrawingActions];

	function DrawingActions() {
		_['base'].apply(this, arguments);
	}

	DrawingActions.ValidateRectangle=function (value) {
		if (!value||typeof value!=='object') {
			throw new Error('Rectangle arguments are missing.');
		}
		let fraction=(number)=>typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=1;
		let color=(text)=>typeof text==='string'&&/^#[\da-fA-F]{6}$/.test(text);
		if (!fraction(value.x)||!fraction(value.y)||!fraction(value.width)||!fraction(value.height)||
			!value.width||!value.height||value.x+value.width>1||value.y+value.height>1||
			!color(value.stroke)||typeof value.strokeWidth!=='number'||!Number.isFinite(value.strokeWidth)||
			value.strokeWidth<1||value.strokeWidth>100||(value.fill!=null&&!color(value.fill))) {
			throw new Error('Invalid rectangle position, size, or color.');
		}
		return value;
	};

	DrawingActions.Execute=async function (action, image) {
		if (action.name!=='drawRectangle') {
			throw new Error(`Unsupported local action: ${action.name}`);
		}
		if (!image) {
			throw new Error('Load an image before drawing a rectangle.');
		}
		let args=DrawingActions.ValidateRectangle(action.arguments);
		let source=new Image();
		source.src=`data:${image.mimeType};base64,${image.base64}`;
		await source.decode();
		let canvas=document.createElement('canvas');
		canvas.width=source.naturalWidth;
		canvas.height=source.naturalHeight;
		let context=canvas.getContext('2d');
		if (!context) throw new Error('The drawing canvas is unavailable.');
		context.drawImage(source, 0, 0);
		context.lineWidth=args.strokeWidth;
		context.strokeStyle=args.stroke;
		if (args.fill) {
			context.fillStyle=args.fill;
			context.fillRect(args.x*canvas.width, args.y*canvas.height, args.width*canvas.width, args.height*canvas.height);
		}
		context.strokeRect(args.x*canvas.width, args.y*canvas.height, args.width*canvas.width, args.height*canvas.height);
		return {
			...image
			, id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
			, base64: canvas.toDataURL('image/png').split(',')[1]
			, mimeType: 'image/png'
			, mediaId: undefined
			, prompt: 'Local rectangle edit'
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, title: `${image.title} · Rectangle`
		};
	};
});

