(() => {
	// TODO: Step is not supported (which means seconds cannot be chosen)
	// TODO: Fire input events when value is chosen
	const isTwelveHour = (new Date(2020, 10, 24, 13, 0)).toLocaleTimeString().indexOf("13") === -1;
	const validTimeString = /^([0-9]{2}):([0-9]{2})$/;
	const validUserInputTimeString = isTwelveHour ?
		/^([0-9]{1,2}):([0-9]{2}) *?([AP]\.?M\.?)$/i : /^([0-9]{1,2}):([0-9]{2})$/i;
	let openedElement;
	let iframeWindow;
	let firstTimeLoadingFrame = true;
	const isValidTimeString = function(str){
		const timeMatch = val.match(validTimeString);
		if(timeMatch == null){
			return false;
		}
		const hour = dateMatch[1] | 0;
		const minute = dateMatch[2] | 0;
		return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
	}
	const s_timeValue = Symbol("timeValue");
	const s_normalizeUserInput = Symbol("normalizeUserInput");
	// Using iframes here prevent the date input boxes from inherenting CSS rules
	const iframe = document.createElement("iframe");
	iframe.style.position = "absolute";
	iframe.style.backgroundColor = "#fff"; // I had no idea these were transparent by default
	if(isTwelveHour){
		iframe.style.width = "150px";
	}else{
		iframe.style.width = "100px";
	}
	iframe.style.height = "30px";
	window.addEventListener("click", e => {
		if(e.target === openedElement){
			return;
		}else if(openedElement != null){
			iframe.remove();
			openedElement = null;
		}
	});
	const registerTimeInput = function(element){
		if(element[s_timeValue] != null){
			return;
		}
		element[s_timeValue] = NaN;
		element[s_normalizeUserInput] = function(str){
			const timeMatch = String(str).match(validUserInputTimeString);
			if(timeMatch == null){
				element.value = "";
				return;
			}
			let [_, hour, minute, meridiem] = timeMatch;
			hour = Number(hour);
			monite = Number(minute);
			if(meridiem){
				if(hour === 12){
					hour -= 12;
				}
				if(meridiem.toLowerCase()[0] === "p"){
					hour += 12; 
				}
			}
			element.value = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
		}
		const valueGetterSetterDef = {
			configurable: true,
			get: () => {
				const minutes = element[s_timeValue] / 1000 / 60;
				return isNaN(minutes) ? "" : (
					String((minutes / 60) | 0).padStart(2, "0") + ":" +
					String(minutes % 60).padStart(2, "0")
				);
			},
			set: (v) => {
				const timeMatch = String(v).match(validTimeString);
				if(timeMatch == null){
					element.valueAsNumber = NaN;
				}else{
					const [_, hour, minute] = timeMatch;
					element.valueAsNumber = (Number(hour) * 60 * 60 * 1000) + (Number(minute) * 60 * 1000);
				}
			}
		}
		const originalValue = element.value;
		Object.defineProperty(element, "value", valueGetterSetterDef);
		Object.defineProperty(element, "valueAsNumber", {
			get: () => {
				return element[s_timeValue];
			},
			set: (v) => {
				const newValue = Number(v) % 86400000;
				element[s_timeValue] = newValue;
				delete element.value;
				if(isNaN(newValue)){
					element.value = "--:--";
					if(isTwelveHour){
						element.value += " --";
					}
				}else{
					const totalMinutes = newValue / 1000 / 60;
					let hour = (totalMinutes / 60) | 0;
					const minutes = totalMinutes % 60;
					let meridiem = "";
					if(isTwelveHour){
						meridiem = hour < 12 ? " AM" : " PM";
						if(hour > 12){
							hour -= 12;
						}else if(hour === 0){
							hour = 12;
						}
					}
					element.value = isNaN(minutes) ? "" : (
						String(hour).padStart(2, "0") + ":" +
						String(minutes).padStart(2, "0") +
						meridiem
					);
				}
				Object.defineProperty(element, "value", valueGetterSetterDef);
			}
		});
		Object.defineProperty(element, "valueAsDate", {
			get: () => {
				return isNaN(element[s_timeValue]) ? null : new Date(element[s_timeValue]);
			},
			set: (v) => {
				if(!v instanceof Date){
					throw new TypeError("Value must be a date object");
				}
				element.valueAsNumber = v.getTime();
			}
		});
		element.addEventListener("click", async e => {
			e.preventDefault();
			element.offsetParent.appendChild(iframe);
			iframe.style.top = (element.offsetTop + element.offsetHeight) + "px";
			iframe.style.left = element.offsetLeft + "px";
			if(firstTimeLoadingFrame){
				// All browsers (which I care about) that don't support input type date support srcdoc
				// srcdoc is required unless I want to host the html elsewhere... but I kinda want this polyfill to be self-contained
				// the domain of data urls is always null... for some reason, and thus cannot do messages
				iframe.srcdoc = `<!DOCTYPE html>
				<html>
					<head>
						<meta charset="utf-8">
						<style>
							html, body{
								margin: 1px;
							}
							body {
								display: flex;
								align-items: center;
								justify-content: start;
							}
							span {
								margin: 2px;
							}
							#meridiemSelector{
								margin-left: 2px;
							}
						</style>
					</head>
					<body>
						<select id="hourSelector"></select>
						<span>:</span>
						<select id="minuteSelector"></select>
						<select id="meridiemSelector">
							<option value="AM">AM</option>
							<option value="PM">PM</option>
						</select>
					</body>
					<script>
						// TODO: Support step
						const isTwelveHour = (new Date(2020, 10, 24, 13, 0)).toLocaleTimeString().indexOf("13") === -1;
						const sendSelectedTime = function(){
							let hour = hourSelector.value;
							if(isTwelveHour && meridiemSelector.value !== "AM"){
								hour = String(Number(hour) + 12).padStart(2, "0");
							}
							const minute = minuteSelector.value;
							if(window.parent === window){
								console.log(hour + ":" + minute);
							}else{
								window.parent.postMessage(hour + ":" + minute);
							}
						}
						hourSelector.onchange = sendSelectedTime;
						minuteSelector.onchange = sendSelectedTime;
						meridiemSelector.onchange = sendSelectedTime;
						if(isTwelveHour){
							for(let i = 1; i < 12; i += 1){
								const hourOption = document.createElement("option");
								const val = String(i).padStart(2, "0");
								hourOption.innerText = val;
								hourOption.value = val;
								hourSelector.appendChild(hourOption);
							}
							const twelveHourOption = document.createElement("option");
							twelveHourOption.innerText = "12";
							twelveHourOption.value = "00";
							hourSelector.appendChild(twelveHourOption);
						}else{
							meridiemSelector.style.display = "none";
							for(let i = 0; i < 24; i += 1){
								const hourOption = document.createElement("option");
								const val = String(i).padStart(2, "0");
								hourOption.innerText = val;
								hourOption.value = val;
								hourSelector.appendChild(hourOption);
							}
						}
						for(let i = 0; i < 60; i += 1){
							const minuteOption = document.createElement("option");
							const val = String(i).padStart(2, "0");
							minuteOption.innerText = val;
							minuteOption.value = val;
							minuteSelector.appendChild(minuteOption);
						}
						window.addEventListener("message", e => {
							if(e.source !== window.parent){
								return;
							}
							if(/^[0-9]{2}:[0-9]{2}/.test(e.data)){
								let [hour, minute] = e.data.split(":", 2).map(v => Number(v));
								if(isTwelveHour){
									if(hour >= 12){
										hour -= 12;
										meridiemSelector.value = "PM";
									}else{
										meridiemSelector.value = "AM";
									}	
								}
								hourSelector.value = String(hour).padStart(2, "0");
								minuteSelector.value = String(minute).padStart(2, "0");
							}
						});
					</script>
				</html>`
				firstTimeLoadingFrame = false;
			}
			iframeWindow = iframe.contentWindow;
			await new Promise(resolve => {
				iframe.onload = resolve;
			});
			iframeWindow.postMessage(element.value);
			openedElement = element;
		});
		element.addEventListener("input", e => {
			delete element.value;
			const originalValue = element.value;
			Object.defineProperty(element, "value", valueGetterSetterDef);
			if(validUserInputTimeString.test(originalValue)){
				element[s_normalizeUserInput](originalValue);
				if(openedElement == element){
					iframeWindow.postMessage(element.value);
				}
			}else{
				Object.defineProperty(element, "value", valueGetterSetterDef);
			}
		});
		element.addEventListener("blur", e => {
			delete element.value;
			const originalValue = element.value;
			Object.defineProperty(element, "value", valueGetterSetterDef);
			if(!validUserInputTimeString.test(originalValue)){
				element.value = "";
				if(openedElement == element){
					iframeWindow.postMessage("");
				}
			}
			Object.defineProperty(element, "value", valueGetterSetterDef);
		});
		element[s_normalizeUserInput](originalValue);
	}
	window.addEventListener("message", e => {
		if(e.source === iframeWindow && openedElement != null){
			openedElement.value = e.data;
		}
	});
	window.timeInputPolyfill = {
		registerTimeInput
	}
})();
