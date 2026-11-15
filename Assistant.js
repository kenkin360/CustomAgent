var Assistant=Function.extend(Object, function () {
	var _=this(Assistant);
	Assistant=_[Assistant];

	function Assistant(app) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_app=app;
		$this.m_detach=app.SubscribeMessage((message, turn)=>$this.HandleMessage(message, turn));
		$this.m_detachEvent=app.SubscribeEvent((event, details, image)=>$this.Report(event, details, image));
		$this.m_dynamicModules=[];
		$this.m_ready=$this.Welcome();
	}

	_['public'].Destroy=function () {
		_(this).m_detach?.();
		_(this).m_detachEvent?.();
	};

	_['private'].Welcome=async function () {
		let $this=_(this);
		let app=$this.m_app;
		let setupError='';
		let runtime={message: ''};

		try {
			await app.Initialize();
		}
		catch (error) {
			setupError=error.message||String(error);
		}

		try {
			runtime=await app.InspectRuntime({});
		}
		catch (error) {
			setupError=[setupError, error.message||String(error)].filter(Boolean).join('; ');
		}

		try {
			let response=await Flow.generate.text('你是否了解自己的能力?', {systemInstruction: `
你正在此 App 中啟動。請依照下列實際檢查結果簡短歡迎使用者，僅描述確實可用的能力。這裡只有原碼檔案清單與執行狀態；需要原碼內容時再使用對應讀取操作。若啟動失敗，說明真實錯誤。請依瀏覽器語系或使用者對話語言回覆；無法判斷時使用英文。
${runtime.message}
啟動結果：${setupError||'success'}
瀏覽器語系：${navigator.language}
不可聲稱尚未執行的操作已經成功。不要輸出操作控制 JSON。
`});
			if (response.text?.trim()&&!app.GetState().messages.length) app.Reply(response.text.trim());
		}
		catch (error) {
			app.ReportError(error);
		}
	};

	_['private'].ReadControl=function (value) {
		let marker=String.fromCharCode(96).repeat(3);
		let pattern=new RegExp(`${marker}json\\s*([\\s\\S]*?)\\s*${marker}`, 'gi');

		for (let block of [...String(value).matchAll(pattern)].reverse()) {
			try {
				let data=JSON.parse(block[1]);
				if (!data||!Object.prototype.hasOwnProperty.call(data, 'localAction')) continue;

				let remaining=(value.slice(0, block.index)+value.slice(block.index+block[0].length)).trim();
				let source=null;
				let Type=null;

				if (data.localAction?.name==='loadModule') {
					let sourceBlocks=[...remaining.matchAll(/(?:^|\n)```(javascript|js|text|url)\s*\n([\s\S]*?)\n```(?=\s*(?:\n|$))/gi)];
					let last=sourceBlocks.at(-1);

					if (last) {
						Type={javascript: Resource.Inline, js: Resource.Inline, text: Resource.Module, url: Resource.Module}[last[1].toLowerCase()];
						source=Type===Resource.Module?last[2].trim():last[2];
						remaining=(remaining.slice(0, last.index)+remaining.slice(last.index+last[0].length)).trim();
					}
				}

				return {Data: data, Text: remaining, Source: source, Type};
			}
			catch (error) {
				console.warn('Invalid conversation control', error);
			}
		}

		try {
			let data=JSON.parse(String(value).trim());
			if (data&&Object.prototype.hasOwnProperty.call(data, 'localAction')) {
				return {Data: data, Text: '', Source: null, Type: null};
			}
		}
		catch (error) {
		}

		if (/(?:^|\n)```json\s*\n/i.test(value)&&/(?:^|\n)```(?:javascript|js)\s*\n/i.test(value)) {
			throw new Error('Module code was returned with an invalid action decision; nothing was installed.');
		}

		return {Data: null, Text: String(value).trim(), Source: null, Type: null};
	};

	_['private'].Instruction=function (runtime) {
		let $this=_(this);
		let dynamicList=$this.m_dynamicModules.length
			?$this.m_dynamicModules.map((m)=>`${m.name} (載入時間: ${m.time})`).join(', ')
			:'(無)';

		return `
你是此 App 的 Assistant。你可以討論需求，也可以請 App 執行本地操作；只有使用者按下生成按鈕才生成影像。請依使用者本輪使用的語言自然答覆，無法判斷時參考對話或瀏覽器語系，仍無法判斷時使用英文。
實際能力：${runtime.message}
【重要履歷 - 本次 Session 由你（Assistant）動態撰寫並載入的模組】：${dynamicList}
(注意：若上方列表中包含模組，代表這些模組是你在之前的對話中為使用者現場撰寫並動態注入到 Runtime 的，請清楚認知這是你自己的成果，不可誤認為是系統預載。若清單為無，則代表尚未動態撰寫新模組。)

需要操作時，在答覆最後附一個 json 程式碼區塊，包含 {"attemptPlan":[{"action":"操作名稱","attempts":1,"reason":"目的與重試條件"}],"localAction":{"name":"操作名稱","arguments":{}}}。不需要操作時可直接以一般文字答覆。App 每次只執行一項操作，並將真實結果送回；依結果繼續、調整或停止。不必固定重試次數，但不要重複已成功的操作。收到成功結果前不得宣稱已完成。
readCompiledSource 空參數列出啟動時已完整拆解的固定 host 檔案，{file} 取得完整原碼；readRemoteSource 空參數列出 Bundle.Config 等遠端來源，{name} 可重新取得其內容；readInstalledSource 空參數列出已安裝模組，{name} 取得安裝時保留的完整原碼，遠端安裝者可重新取得。inspectRuntime 檢查現有函數、模組及原碼入口。不要聲稱讀過尚未透過操作取得的原碼。
loadModule 使用程式碼或網址作為獨立的原始文字，不放進 JSON。請先輸出一個 javascript 程式碼區塊（新模組原碼），或一個 text 程式碼區塊（遠端腳本 URL）；接著在答覆最後輸出操作控制 JSON，其 localAction 為 {"name":"loadModule","arguments":{"name":"模組名稱"}}，並在 attemptPlan 列出 loadModule。App 依程式碼區塊類型選擇 Resource.Inline（javascript/js）或 Resource.Module（text/url），以該名稱取得 JavaScript 值；不要求繼承、建立實例或使用 export/globalThis 賦值。若載入值有靜態 Run 函數，以模組名稱直接呼叫。頂層類型以 var 宣告。
直接以模組名稱作為操作名稱呼叫其 Run；rollback 恢復上一項安裝前的全域類型名稱、模組登記與來源記錄，不恢復 UI；resetConversation 清空對話。需要實作新功能時可先讀程式碼，再撰寫並載入模組；不要以不存在的功能已預載為由拒絕。
可用模組可使用瀏覽器標準 API，操作目前影像時，模組的 Run 收到參數與 {image}，回傳 {message,image:{base64,mimeType}}。UI 可透過 AppRuntime.UI.Mount 掛入介面；會改動 UI 的模組應自行提供可呼叫的清理函數，rollback 不代替模組清理 UI。模組可以只保留類型與靜態方法，若自行建立單例，應在 Function.extend 的類別定義內完成。不要假設原始 App 檔案可被本次 runtime 修改永久覆寫。
若有待使用者確認的生成修改，可於 JSON 加入 accumulatedChanges、suggestedPrompt、aspectRatio；已完成的本地操作不得當作待生成修改。操作結果與錯誤由 App 回傳；答覆使用者時說明真實結果，不展示控制 JSON 或原始工具輸出，除非使用者要求查看。
`;
	};

	_['private'].HandleMessage=async function (message, turn) {
		let $this=_(this);
		await $this.m_ready;
		if (turn?.cancelled) return;

		let app=$this.m_app;
		let initial=app.GetState();
		let imageInfo=await app.GetImageInfo();
		if (turn?.cancelled) return;

		let prior=initial.messages.slice();
		if (prior.at(-1)?.sender==='user'&&prior.at(-1)?.text===message) prior.pop();

		let history=prior.slice(-20).map((entry)=>`${entry.sender}: ${entry.text}`).join('\n\n');
		let changes=initial.accumulatedChanges.length
			?initial.accumulatedChanges.map((entry, index)=>`${index+1}. ${entry}`).join('\n')
			:'(none)';

		let question=()=>`
Current image: ${imageInfo?`${imageInfo.width} × ${imageInfo.height} pixels (${imageInfo.mimeType})`:'none'}
Selected generation aspect ratio: ${initial.selectedRatio}
Pending generation changes:
${changes}
Previous conversation (up to 20 messages):
${history}
Current user message:
${message}
`;

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
			if (turn?.cancelled) return;

			let request=reports.length?`
${question()}
Current action plan: ${JSON.stringify(plan)}
Actual action results:
${reports.map(JSON.stringify).join('\n')}
Choose the next action, revise the plan, or give a final answer. If a module failed to load, use its reported error to rewrite the source before retrying; do not repeat the same failed source. Do not repeat successful actions or claim failed actions succeeded.
`:question();

			let options={systemInstruction: $this.Instruction(runtime)};
			if (image) options.images=[{base64: image.base64, mimeType: image.mimeType}];

			let response=await Flow.generate.text(`${request}. `, options);
			if (turn?.cancelled) return;

			let control=$this.ReadControl(response.text);
			answer=control.Text;

			let data=control.Data;
			if (data) {
				structured=true;
				if (Array.isArray(data.accumulatedChanges)) {
					changesOut=data.accumulatedChanges.filter((item)=>typeof item==='string');
				}
				if (typeof data.suggestedPrompt==='string') promptOut=data.suggestedPrompt;
				if (['original', '1:1', '16:9', '9:16', '4:3', '3:4'].includes(data.aspectRatio)) {
					ratioOut=data.aspectRatio;
				}
				if (Array.isArray(data.attemptPlan)&&data.attemptPlan.length) plan=data.attemptPlan;
			}

			let action=data?.localAction;
			if (!action||typeof action.name!=='string') break;

			if (!plan.some((entry)=>entry.action===action.name)) {
				reports.push({
					action: action.name
					, status: 'error'
					, result: 'The action needs an attemptPlan entry before execution.'
				});
				continue;
			}

			try {
				if (turn?.cancelled) return;

				let result=await app.RunAction(action, true, control.Source, control.Type);
				if (turn?.cancelled) return;

				if (result.conversationReset) {
					let fresh=await Flow.generate.text('.', {systemInstruction: `
App 已清空對話。以使用者這次要求的語言自然回覆，無須提及先前對話。不要輸出操作控制 JSON。
`});
					if (turn?.cancelled) return;
					if (!fresh.text?.trim()) throw new Error('The model returned an empty answer.');
					app.Reply(fresh.text.trim());
					return;
				}

				if (result.image) {
					image=result.image;
					imageInfo={
						width: image.width
						, height: image.height
						, mimeType: image.mimeType
					};
					edited=result.image;
				}

				if (action.name==='loadModule') {
					let modName=action.arguments?.name||'CustomModule';
					if (!$this.m_dynamicModules.some((m)=>m.name===modName)) {
						$this.m_dynamicModules.push({
							name: modName
							, time: new Date().toLocaleTimeString()
						});
					}
				}

				reports.push({
					action: action.name
					, status: 'success'
					, result: result.message
					, ...(result.image?{
						image: {
							width: result.image.width
							, height: result.image.height
							, mimeType: result.image.mimeType
						}
					}:{})
				});
				runtime=await app.InspectRuntime({});
			}
			catch (error) {
				reports.push({
					action: action.name
					, status: 'error'
					, result: error instanceof Error?error.message:String(error)
				});
			}
		}

		if (!answer) {
			let prompt=`
${question()}
Actual action results:
${reports.map(JSON.stringify).join('\n')}
Give the user your final answer based on these results, without requesting another action or outputting control JSON.
`;
			let response=await Flow.generate.text(`${prompt}. `, {systemInstruction: `
依使用者的語言回答。只能聲稱 App 已回報成功的操作，並準確說明失敗原因。請勿輸出控制 JSON。
`});
			if (turn?.cancelled) return;
			answer=response.text?.trim();
		}

		if (!answer) throw new Error('The model returned an empty answer me.');
		if (turn?.cancelled) return;

		if (structured) {
			app.UpdateConversation({
				accumulatedChanges: changesOut
				, generationPrompt: changesOut.length?promptOut:''
				, selectedRatio: ratioOut
			});
		}

		app.Reply(answer, {
			accumulatedChanges: changesOut
			, suggestedPrompt: promptOut||undefined
			, aspectRatio: ratioOut
			, ...(edited?{
				includedImage: {
					base64: edited.base64
					, mimeType: edited.mimeType
				}
			}:{})
		});
	};

	_['private'].Report=async function (event, details={}, image) {
		await _(this).m_ready;

		let messages=_(this).m_app.GetState().messages.slice(-8)
			.map((entry)=>`${entry.sender}: ${entry.text}`)
			.join('\n');

		let prompt=`
Recent conversation:
${messages}
App event: ${event}
Actual result: ${JSON.stringify(details)}
Reply briefly to the user in the language of the current conversation.
`;
		let response=await Flow.generate.text(`${prompt}. `, {systemInstruction: `
僅說明 App 回報的真實結果，不宣稱未回報成功的操作；依使用者當前對話語言回覆，不輸出控制 JSON。
`});

		if (!response.text?.trim()) throw new Error('The model returned an empty answer.');
		_(this).m_app.Reply(response.text.trim(), image?{includedImage: image}:{});
	};

	_['private'].m_app=null;
	_['private'].m_detach=null;
	_['private'].m_detachEvent=null;
	_['private'].m_ready=null;
	_['private'].m_dynamicModules=null;
});
