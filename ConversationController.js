var ConversationController=Function.extend(Object, function () {
	var _=this(ConversationController);
	ConversationController=_[ConversationController];

	function ConversationController() {
		_['base'].apply(this, arguments);
	}

	ConversationController.Instruction=`你可以討論需求，也可以透過 App 執行本地操作或安裝本次運行期間有效的程式碼。只有使用者明確按下生成按鈕才生成影像。

需要操作時，在答覆最後附一個 json 程式碼區塊，包含 {"attemptPlan":[{"action":"操作名稱","attempts":1,"reason":"目的與重試條件"}],"localAction":{"name":"操作名稱","arguments":{}}}。不需要操作時使用 {"localAction":null}。第一次操作前須提出計畫；根據實際結果修訂計畫、繼續或停止。操作結果由 App 回傳；收到結果前不得聲稱成功。最後以使用者的語言回答，不要貼出控制 JSON 或原始工具輸出，除非使用者要求查看。

可用操作：drawRectangle、readAppSource、inspectRuntime、installCode、loadModule、callRuntime、rollbackCode、resetConversation。readAppSource 的空參數列出已打包檔案，{file,query} 查閱內容。installCode 接受 {code}，其中 JavaScript 模組的 default 函式接收 AppRuntime；AppRuntime.UI 提供 GetState、RunAction、GenerateText、UpdateConversation、SetConversationHandler 等方法。可以改寫本次運行中的對話控制，也可以從 esm.sh 載入外部模組。

若有待使用者確認的生成修改，可在 JSON 加入 accumulatedChanges、suggestedPrompt 與 aspectRatio；已完成的本地操作不列為待生成修改。若操作失敗，須根據真實錯誤說明。`;

	_['private'].ReadControl=function (value) {
		let marker=String.fromCharCode(96).repeat(3);
		let pattern=new RegExp(`${marker}json\\s*([\\s\\S]*?)\\s*${marker}`, 'g');
		for (let block of [...value.matchAll(pattern)].reverse()) {
			try {
				let data=JSON.parse(block[1]);
				if (!data||!Object.prototype.hasOwnProperty.call(data, 'localAction')) continue;
				return {
					Data: data
					, Text: (value.slice(0, block.index)+value.slice(block.index+block[0].length)).trim()
				};
			}
			catch (error) {
				console.warn('Invalid conversation control', error);
			}
		}
		return {Data: null, Text: value.trim()};
	};

	_['private'].AddMessage=function (ui, text, fields={}) {
		let state=ui.GetState();
		ui.UpdateConversation({messages: [...state.messages, {
			id: 'agent_'+Date.now()+'_'+Math.random()
			, sender: 'agent'
			, text
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, ...fields
		}]});
	};

	_['public'].Send=async function (message, ui) {
		let $this=_(this);
		let initial=ui.GetState();
		let prior=initial.messages.filter((entry)=>entry.id!=='welcome');
		if (prior.at(-1)?.sender==='user'&&prior.at(-1)?.text===message) prior.pop();
		let history=prior.slice(-20).map((entry)=>`${entry.sender}: ${entry.text}`).join('\n\n');
		let changes=initial.accumulatedChanges.length
			?initial.accumulatedChanges.map((entry, index)=>`${index+1}. ${entry}`).join('\n')
			:'(none)';
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

		for (;;) {
			let request=reports.length
				?`${question}\nCurrent action plan: ${JSON.stringify(plan)}\nActual action results:\n${reports.map(JSON.stringify).join('\n')}\nChoose the next action, revise the plan, or give a final answer. Do not repeat successful actions or claim failed actions succeeded.`
				:question;
			let options={systemInstruction: ConversationController.Instruction};
			if (image) options.images=[{base64: image.base64, mimeType: image.mimeType}];
			let response=await ui.GenerateText(request, options);
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
				let result=await ui.RunAction(action);
				if (result.conversationReset) return;
				if (result.image) {
					image=result.image;
					edited=result.image;
				}
				reports.push({action: action.name, status: 'success', result: result.message});
			}
			catch (error) {
				reports.push({action: action.name, status: 'error', result: error instanceof Error?error.message:String(error)});
			}
		}

		while (!answer||reports.some((item)=>answer===item.result||answer===`${item.action}: ${item.result}`)) {
			let summary=await ui.GenerateText(`${question}\nActual action results:\n${reports.map(JSON.stringify).join('\n')}\nGive the user a final answer based on these results. Do not request another action or output control JSON.`, {
				systemInstruction: 'Answer in the user\'s language. State failures accurately.'
			});
			answer=summary.text.trim();
		}
		if (structured) {
			ui.UpdateConversation({
				accumulatedChanges: changesOut
				, generationPrompt: changesOut.length?promptOut:''
				, selectedRatio: ratioOut
			});
		}
		$this.AddMessage(ui, answer, {
			accumulatedChanges: changesOut
			, suggestedPrompt: promptOut||undefined
			, aspectRatio: ratioOut
			, ...(edited?{includedImage: {base64: edited.base64, mimeType: edited.mimeType}}:{})
		});
	};
});

globalThis.ConversationController=ConversationController;
