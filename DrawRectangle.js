var DrawRectangle=Function.extend(Executable, function () {
	var _=this(DrawRectangle);
	DrawRectangle=_[DrawRectangle];

	function DrawRectangle() {
		_['base'].apply(this, arguments);
	}

	_['private'].Validate=function (value) {
		if (!value||typeof value!=='object') { return Helper.Error('Rectangle arguments are missing.'); }

		let fraction=(number)=>typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=1;
		let color=(text)=>typeof text==='string'&&/^#[\da-fA-F]{6}$/.test(text);
		if (!fraction(value.x)||!fraction(value.y)||!fraction(value.width)||!fraction(value.height)||
			!value.width||!value.height||value.x+value.width>1||value.y+value.height>1||
			!color(value.stroke)||typeof value.strokeWidth!=='number'||!Number.isFinite(value.strokeWidth)||
			value.strokeWidth<1||value.strokeWidth>100||(value.fill!=null&&!color(value.fill))) {
			return Helper.Error('Invalid rectangle position, size, or color.');
		}

		return value;
	};

	_['public'].Run=async function (value, context) {
		let image=context.image;
		if (!(image instanceof Media.Image)||!image.Data) { return Helper.Error('Load an image before drawing a rectangle.'); }

		let args=_(this).Validate(value);
		if (args instanceof Error) {
			return args;
		}

		let source=new Image();
		let url=URL.createObjectURL(image.Data);
		try {
			source.src=url;
			await source.decode();
		}
		finally {
			URL.revokeObjectURL(url);
		}

		let canvas=document.createElement('canvas');
		canvas.width=source.naturalWidth;
		canvas.height=source.naturalHeight;
		let output=canvas.getContext('2d');
		if (!output) { return Helper.Error('The drawing canvas is unavailable.'); }

		output.drawImage(source, 0, 0);
		output.lineWidth=args.strokeWidth;
		output.strokeStyle=args.stroke;
		if (args.fill) {
			output.fillStyle=args.fill;
			output.fillRect(args.x*canvas.width, args.y*canvas.height, args.width*canvas.width, args.height*canvas.height);
		}

		output.strokeRect(args.x*canvas.width, args.y*canvas.height, args.width*canvas.width, args.height*canvas.height);
		return {message: 'Rectangle drawn on the current image.', image: new Media.Image({
			base64: canvas.toDataURL('image/png').split(',')[1]
			, mimeType: 'image/png'
			, width: canvas.width
			, height: canvas.height
			, title: image.Title+' · Rectangle'
		})};
	};

	_['public'].Description='Draw a rectangle on the current image. Arguments: normalized x, y, width, height (0–1), stroke (#RRGGBB), strokeWidth (pixels), optional fill (#RRGGBB).';
});
