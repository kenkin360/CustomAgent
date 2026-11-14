var Assistant=Function.extend(Object, function () {
	var _=this(Assistant);
	Assistant=_[Assistant];

	function Assistant(app) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_app=app;
		$this.m_detach=app.SubscribeMessage((message)=>$this.HandleMessage(message));
		$this.m_detachEvent=app.SubscribeEvent((event, details, image)=>$this.Report(event, details, image));
		$this.m_ready=$this.Welcome();
	}

	_['public'].GenerateText=function (prompt, options) {
		return Flow.generate.text(prompt, options);
	};

	_['public'].Destroy=function () {
		_(this).m_detach?.();
		_(this).m_detachEvent?.();
	};

	_['private'].Welcome=async function () {
		let $this=_(this);
		let app=$this.m_app;
		try {
			await app.Initialize();
			let capabilities=await app.ReadSource({});
			let runtime=await app.InspectRuntime({});
			let source='';
			try { source=(await app.ReadSource({file: 'CustomAgent.js', limit: 9000}, app.props.HostSourceUrl)).message; }
			catch (error) { console.warn('Startup source inspection failed:', error); }
			let response=await this.GenerateText(`You are running inside this App. Inspect its actual capabilities before introducing yourself.\n${capabilities.message}\n${runtime.message}\n${source}\nInterface locale: ${navigator.language}. Briefly greet the user in the language appropriate for the interface or conversation. Describe only capabilities verified above.`, {
				systemInstruction: 'You are the assistant inside this App. Reply to the user naturally in the appropriate language. Do not claim an action occurred unless the App reported it.'
			});
			if (response.text?.trim()&&!app.GetState().messages.length) app.Reply(response.text.trim());
		}
		catch (error) {
			app.ReportError(error);
		}
	};

	_['private'].ReadControl=function (value) {
		let marker=String.fromCharCode(96).repeat(3);
		let pattern=new RegExp(`${marker}json\\s*([\\s\\S]*?)\\s*${marker}`, 'g');
		for (let block of [...String(value).matchAll(pattern)].reverse()) {
			try {
				let data=JSON.parse(block[1]);
				if (!data||!Object.prototype.hasOwnProperty.call(data, 'localAction')) continue;
				return {Data: data, Text: (value.slice(0, block.index)+value.slice(block.index+block[0].length)).trim()};
			}
			catch (error) { console.warn('Invalid conversation control', error); }
		}
		return {Data: null, Text: String(value).trim()};
	};

	_['private'].RecoverIfRequested=async function (message) {
		let app=this.m_app;
		if (!app.HasVersion()) return false;
		if (/^\s*\/(?:rollback|undo)\s*$/i.test(message)) {
			await this.Report('The App restored the previous runtime code version.', {Result: app.Rollback()});
			return true;
		}
		let response=await this.GenerateText(message, {
			systemInstruction: 'Classify whether the user asks to undo a recent runtime code change or says the latest change is broken and should be undone. Answer exactly ROLLBACK or CONTINUE. A question about an error or a request for a new fix is CONTINUE.'
		});
		if (!/^ROLLBACK\b/i.test(response.text.trim())) return false;
		await this.Report('The App restored the previous runtime code version.', {Result: app.Rollback()});
		return true;
	};

	_['private'].HandleMessage=async function (message) {
		let $this=_(this);
		await $this.m_ready;
		if (await $this.RecoverIfRequested(message)) return;
		let app=$this.m_app;
		let initial=app.GetState();
		let prior=initial.messages;
		if (prior.at(-1)?.sender==='user'&&prior.at(-1)?.text===message) prior.pop();
		let history=prior.slice(-20).map((entry)=>`${entry.sender}: ${entry.text}`).join('\n\n');
		let changes=initial.accumulatedChanges.length?initial.accumulatedChanges.map((entry, index)=>`${index+1}. ${entry}`).join('\n'):'(none)';
		let question=`Current image: ${initial.activeImage?'attached':'none'}\nPending generation changes:\n${changes}\nPrevious conversation (up to 20 messages):\n${history}\nCurrent user message:\n${message}`;
		let image=initial.activeImage;
		let changesOut=initial.accumulatedChanges;
		let promptOut=initial.generationPrompt;
		let ratioOut=initial.selectedRatio;
		let edited=null;
		let plan=[];
		let reports=[];
		let answer='';
		let structured=false;
		let runtime=await app.InspectRuntime({});
		for (;;) {
			let request=reports.length?`${question}\nCurrent action plan: ${JSON.stringify(plan)}\nActual action results:\n${reports.map(JSON.stringify).join('\n')}\nChoose the next action, revise the plan, or give a final answer. Do not repeat successful actions or claim failed actions succeeded.`:question;
			let options={systemInstruction: `You are the assistant running in this App. Actual capabilities: ${runtime.message}\nYou may discuss freely. Only the user's Generate button starts image generation. To request a local operation, append one final fenced json block with {"attemptPlan":[{"action":"name","attempts":1,"reason":"reason"}],"localAction":{"name":"name","arguments":{}}}. If no operation is needed use {"localAction":null}. The App executes one action and returns its actual result; decide what to do next after reading it. readAppSource with empty arguments lists files; use it to inspect implementation whenever needed. installCode accepts {code}, whose JavaScript module default function receives AppRuntime. AppRuntime.UI is this App. Local operations that completed are not pending image generation changes. Optional JSON fields: accumulatedChanges, suggestedPrompt, aspectRatio. Answer naturally in the user's language. Never claim unreported success or show control JSON unless asked.`};
			if (image) options.images=[{base64: image.base64, mimeType: image.mimeType}];
			let response=await this.GenerateText(request, options);
			let control=$this.ReadControl(response.text);
			answer=control.Text;
			let data=control.Data;
			if (data) {
				structured=true;
				if (Array.isArray(data.accumulatedChanges)) changesOut=data.accumulatedChanges.filter((item)=>typeof item==='string');
				if (typeof data.suggestedPrompt==='string') promptOut=data.suggestedPrompt;
				if (['1:1', '16:9', '9:16', '4:3', '3:4'].includes(data.aspectRatio)) ratioOut=data.aspectRatio;
				if (Array.isArray(data.attemptPlan)&&data.attemptPlan.length) plan=data.attemptPlan;
			}
			let action=data?.localAction;
			if (!action||typeof action.name!=='string') break;
			if (!plan.some((entry)=>entry.action===action.name)) {
				reports.push({action: action.name, status: 'error', result: 'The action needs an attemptPlan entry before execution.'});
				continue;
			}
			try {
				let result=await app.RunAction(action);
				if (result.conversationReset) return;
				if (result.image) { image=result.image; edited=result.image; }
				reports.push({action: action.name, status: 'success', result: result.message});
			}
			catch (error) {
				reports.push({action: action.name, status: 'error', result: error instanceof Error?error.message:String(error)});
			}
		}
		if (!answer||reports.some((item)=>answer===item.result||answer===`${item.action}: ${item.result}`)) {
			let response=await this.GenerateText(`${question}\nActual action results:\n${reports.map(JSON.stringify).join('\n')}\nGive the user your final answer based on these results, without requesting another action or outputting control JSON.`, {systemInstruction: 'Answer in the user\'s language. Explain failures accurately.'});
			answer=response.text?.trim();
		}
		if (!answer) throw new Error('The model returned an empty answer.');
		if (structured) app.UpdateConversation({accumulatedChanges: changesOut, generationPrompt: changesOut.length?promptOut:'', selectedRatio: ratioOut});
		app.Reply(answer, {
			accumulatedChanges: changesOut
			, suggestedPrompt: promptOut||undefined
			, aspectRatio: ratioOut
			, ...(edited?{includedImage: {base64: edited.base64, mimeType: edited.mimeType}}:{})
		});
	};

	_['private'].Report=async function (event, details={}, image) {
		await _(this).m_ready;
		let messages=_(this).m_app.GetState().messages.slice(-8).map((entry)=>`${entry.sender}: ${entry.text}`).join('\n');
		let response=await this.GenerateText(`Recent conversation:\n${messages}\nApp event: ${event}\nActual result: ${JSON.stringify(details)}\nReply briefly to the user in the language of the current conversation.`, {systemInstruction: 'Describe only the actual App result. Do not claim unreported actions. Do not output control JSON.'});
		if (!response.text?.trim()) throw new Error('The model returned an empty answer.');
		_(this).m_app.Reply(response.text.trim(), image?{includedImage: image}:{});
	};

	_['private'].m_app=null;
	_['private'].m_detach=null;
	_['private'].m_detachEvent=null;
	_['private'].m_ready=null;
});
