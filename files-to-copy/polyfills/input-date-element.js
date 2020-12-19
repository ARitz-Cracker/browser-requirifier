(() => {
	// TODO: Step is not supported
	// TODO: Fire input events when value is chosen
	const validDateString = /^([0-9]{4,})-([0-9]{2})-([0-9]{2})$/;
	const isValidDateString = function(str){
		const dateMatch = val.match(validDateString);
		if(dateMatch == null){
			return false;
		}
		const year = dateMatch[1] | 0;
		const month = dateMatch[2] | 0;
		const day = dateMatch[3] | 0;
		return month >= 1 && month <= 12 && day >= 1 && day <= 31;
	}
	let openedElement = null;
	let firstTimeLoadingFrame = true;
	
	// Using iframes here prevent the date input boxes from inherenting CSS rules
	const iframe = document.createElement("iframe");
	iframe.style.position = "absolute";
	iframe.style.backgroundColor = "#fff"; // I had no idea these were transparent by default
	iframe.style.width = "220px";
	iframe.style.height = "265px";
	let iframeWindow;

	window.addEventListener("click", e => {
		if(e.target === openedElement){
			return;
		}else if(openedElement != null){
			iframe.remove();
			openedElement = null;
		}
	});
	const s_normalizeInputValue = Symbol("normalizeInputValue");
	const s_minDateString = Symbol("minDateString");
	const s_maxDateString = Symbol("maxDateString");
	const s_dateValue = Symbol("dateValue");
	const registerDateInput = function(element){
		if(element[s_normalizeInputValue] != null){
			return;
		}
		element[s_dateValue] = null;
		const valueGetterSetterDef = {
			configurable: true,
			get: () => {
				return element[s_dateValue] == null ? "" : (
					String(element[s_dateValue].getUTCFullYear()).padStart(4, "0") + "-" +
					String(element[s_dateValue].getUTCMonth() + 1).padStart(2, "0") + "-" +
					String(element[s_dateValue].getUTCDate()).padStart(2, "0")
				);
			},
			set: (v) => {
				element[s_normalizeInputValue](String(v));
			}
		}
		element[s_normalizeInputValue] = function(val){
			if(typeof val === "string"){
				const dateMatch = val.match(validDateString);
				if(dateMatch == null){
					element[s_dateValue] = null;
				}else{
					const year = dateMatch[1] | 0;
					const month = dateMatch[2] | 0;
					const day = dateMatch[3] | 0;
					if(month > 12 || month < 1 || day > 31 || day < 1){
						element[s_dateValue] = null;
					}else{
						element[s_dateValue] = new Date(0);
						element[s_dateValue].setUTCFullYear(year);
						element[s_dateValue].setUTCMonth(month - 1);
						element[s_dateValue].setUTCDate(day);
					}
				}
			}else{
				element[s_dateValue] = new Date(val);
				if(isNaN(element[s_dateValue].getTime())){
					element[s_dateValue] = null;
				}else{
					element[s_dateValue].setUTCHours(0);
					element[s_dateValue].setUTCMinutes(0);
					element[s_dateValue].setUTCSeconds(0);
					element[s_dateValue].setUTCMilliseconds(0);
				}
			}
			delete element.value;
			element.value = element[s_dateValue] == null ? "yyyy-mm-dd" : (
				String(element[s_dateValue].getUTCFullYear()).padStart(4, "0") + "-" +
				String(element[s_dateValue].getUTCMonth() + 1).padStart(2, "0") + "-" +
				String(element[s_dateValue].getUTCDate()).padStart(2, "0")
			);
			Object.defineProperty(element, "value", valueGetterSetterDef);
		};
		const originalValue = element.value;
		Object.defineProperty(element, "value", valueGetterSetterDef);
		Object.defineProperty(element, "valueAsDate", {
			get: () => {
				// Return a copy
				return new Date(element[s_dateValue]);
			},
			set: (v) => {
				if(!v instanceof Date){
					throw new TypeError("Value must be a date object");
				}
				element[s_normalizeInputValue](v);
			}
		});
		Object.defineProperty(element, "valueAsNumber", {
			get: () => {
				return element[s_dateValue] == null ? NaN : element[s_dateValue].getTime();
			},
			set: (v) => {
				element[s_normalizeInputValue](Number(v));
			}
		});
		if(!element.min){
			console.warn("Date input doesn't have max set! Things will break!");
		}
		element[s_minDateString] = element.min;
		Object.defineProperty(element, "min", {
			get: () => {
				return element[s_minDateString];
			},
			set: (v) => {
				if(isValidDateString(v)){
					element[s_minDateString] = v;
				}else{
					element[s_minDateString] = "";
				}
			}
		});
		if(!element.max){
			console.warn("Date input doesn't have max set! Things will break!");
		}
		element[s_maxDateString] = element.max;
		Object.defineProperty(element, "max", {
			get: () => {
				return element[s_maxDateString];
			},
			set: (v) => {
				if(isValidDateString(v)){
					element[s_maxDateString] = v;
				}else{
					element[s_maxDateString] = "";
				}
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
							body > div{
								display: flex;
								justify-content: space-around;
								margin: 8px 0px;
							}
							table button {
								width: 20px;
								height: 20px;
								padding: 0px;
								margin: 4px;
							}
							table{
								margin: auto;
								border: none;
								border-collapse: collapse;
							}
							th{
								font-family: sans-serif;
								font-size: small;
							}
							th:first-child, th:nth-child(7){
								color: #ff0000;
							}
							tr,	td {
								margin: 0px;
								padding: 0px;
							}
							td:first-child, td:nth-child(7), th:first-child, th:nth-child(7){
								background-color: #ff000010;
							}
						</style>
					</head>
					<body>
						<div>
							<select id="monthSelector">
								<option value="0">January</option>
								<option value="1">February</option>
								<option value="2">March</option>
								<option value="3">April</option>
								<option value="4">May</option>
								<option value="5">June</option>
								<option value="6">July</option>
								<option value="7">August</option>
								<option value="8">September</option>
								<option value="9">October</option>
								<option value="10">November</option>
								<option value="11">December</option>
							</select>
							<select id="yearSelector">
								<!--Years go here-->
							</select>
						</div>
						<table id="dateTable">
							<tbody>
								<tr>
									<th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th>
								</tr>
							</tbody>
						</table>
						<div>
							<button id="clearButton">Clear</button><button id="closeButton">Close</button>
						</div>
						<script>
							const MIN_DATE = -62135596800000; // 0001-01-01
							const MAX_DATE = 253370764800000; // 9999-12-31 I hope this polyfill isn't used by then
							let minDate = MIN_DATE;
							let maxDate = MAX_DATE;
							let currentDate = "";
				
							const nowDate = new Date();
							if(window.parent === window){
								document.body.style.width = "220px";
								document.body.style.height = "245px";
							}
							yearSelector.value = nowDate.getFullYear();
							monthSelector.value = nowDate.getMonth();
							const weekdayButtons = [];
							for(let i = 0; i < 6; i += 1){
								const weekRow = document.createElement("tr");
								dateTable.children[0].appendChild(weekRow);
								for(let ii = 0; ii < 7; ii += 1){
									const weekdayElem = document.createElement("td");
									weekRow.appendChild(weekdayElem);
									const weekdayButton = document.createElement("button");
									weekdayElem.appendChild(weekdayButton);
									weekdayButton.innerText = "00";
									weekdayButton.onclick = function(e){
										sendDateString(weekdayButton.dataset.dateString);
									}
									weekdayButtons.push(weekdayButton);
								}
							}
							clearButton.onclick = function(e){
								sendDateString("");
							}
							closeButton.onclick = function(e){
								sendDateString(currentDate);
							}
							const sendDateString = function(dateStr){
								if(window.parent === window){
									console.log(dateStr);
								}else{
									window.parent.postMessage(dateStr);
								}
							}
							const DAY_AS_MS = 1000 * 60 * 60 * 24;
							const refreshDateButtons = function(){
								const selectedMonth = new Date(0);
								selectedMonth.setUTCFullYear(yearSelector.value);
								selectedMonth.setUTCMonth(monthSelector.value);
				
								let movefirstDayBy = selectedMonth.getUTCDay();
								if(movefirstDayBy === 0){
									movefirstDayBy = 7;
								}
								const firstDayOnListTimestamp = selectedMonth.getTime() - (DAY_AS_MS * movefirstDayBy);
								for(let i = 0; i < weekdayButtons.length; i += 1){
									const buttonDate = new Date(firstDayOnListTimestamp + DAY_AS_MS * i);
									if(buttonDate.getUTCDay() !== (i % 7)){
										throw new Error("Day of week is wrong (expected " + (i % 7) + " got " + buttonDate.getUTCDay());
									}
									const weekdayButton = weekdayButtons[i];
									// TODO: Always disabled?
									weekdayButton.disabled = buttonDate.getTime() < minDate || buttonDate.getTime() > maxDate;
									if(buttonDate.getUTCMonth() == monthSelector.value){
										weekdayButton.style.opacity = "1";
									}else{
										weekdayButton.style.opacity = "0.5";
									}
									weekdayButton.innerText = buttonDate.getUTCDate();
									weekdayButton.dataset.dateString = (
										String(buttonDate.getUTCFullYear()).padStart(4, "0") + "-" +
										String(buttonDate.getUTCMonth() + 1).padStart(2, "0") + "-" +
										String(buttonDate.getUTCDate()).padStart(2, "0")
									);
								}
							}
							const refreshYearSelector = function(){
								yearSelector.innerHTML = "";
								let currentYear = new Date(minDate);
								currentYear.setUTCDate(1);
								currentYear.setUTCMonth(0);
								while(currentYear.getTime() < maxDate){
									const yearOption = document.createElement("option");
									yearOption.innerText = currentYear.getUTCFullYear();
									yearOption.value = currentYear.getUTCFullYear();
									yearSelector.appendChild(yearOption);
									currentYear.setUTCMonth(12);
								}
							}
							const setMinDate = function(dateStr = "0001-01-01", refreshStuff = true){
								const newMinDate = new Date(0);
								const [year, month, date] = dateStr.split("-", 3).map(v => Number(v));
								newMinDate.setUTCFullYear(year);
								newMinDate.setUTCMonth(month - 1);
								newMinDate.setUTCDate(date);
								minDate = newMinDate.getTime();
								if(refreshStuff){
									refreshYearSelector();
									refreshDateButtons();
								}
							}
							const setMaxDate = function(dateStr = "9999-12-31", refreshStuff = true){
								const newMaxDate = new Date(0);
								const [year, month, date] = dateStr.split("-", 3);
								newMaxDate.setUTCFullYear(year);
								newMaxDate.setUTCMonth(month - 1);
								newMaxDate.setUTCDate(date);
								maxDate = newMaxDate.getTime();
								if(refreshStuff){
									refreshYearSelector();
									refreshDateButtons();
								}
							}
							const setCurrentDate = function(dateStr = ""){
								if(dateStr){
									const [year, month] = dateStr.split("-", 2);
									yearSelector.value = year;
									monthSelector.value = month - 1;
								}else{
									const now = new Date();
									// Not using UTC is intentional here, makes more sense to the user
									yearSelector.value = now.getFullYear();
									monthSelector.value = now.getMonth();
								}
								currentDate = dateStr;
								refreshDateButtons();
							}
							yearSelector.onchange = refreshDateButtons;
							monthSelector.onchange = refreshDateButtons;
							window.addEventListener("message", e => {
								if(e.source !== window.parent){
									return;
								}
								switch(e.data[0]){
									case "setMin":
										setMinDate(e.data[1]);
										break;
									case "setMax":
										setMaxDate(e.data[1]);
										break;
									case "setMinMax":
										setMinDate(e.data[1], false);
										setMaxDate(e.data[2], true);
										break;
									case "setNow":
										setCurrentDate(e.data[1]);
										break;
									default:
										// None
								}
							});
						</script>
					</body>
				</html>`;
				firstTimeLoadingFrame = false;
			}
			await new Promise(resolve => {
				iframe.onload = resolve;
			});
			iframeWindow = iframe.contentWindow;
			iframeWindow.postMessage(["setMinMax", element[s_minDateString], element[s_maxDateString]]);
			iframeWindow.postMessage(["setNow", element.value]);
			openedElement = element;
		});
		element.addEventListener("input", e => {
			delete element.value;
			if(validDateString.test(element.value)){
				element[s_normalizeInputValue](element.value);
				if(openedElement == element){
					iframeWindow.postMessage(["setNow", element.value]);
				}
			}else{
				Object.defineProperty(element, "value", valueGetterSetterDef);
			}
		});
		element.addEventListener("blur", e => {
			delete element.value;
			if(!validDateString.test(element.value)){
				element.value = "yyyy-mm-dd";
				if(openedElement == element){
					iframeWindow.postMessage(["setNow", ""]);
				}
			}
			Object.defineProperty(element, "value", valueGetterSetterDef);
		});
		element[s_normalizeInputValue](originalValue);
	}
	window.addEventListener("message", e => {
		if(e.source === iframeWindow && openedElement != null){
			openedElement.value = e.data;
			iframe.remove();
			openedElement = null;
		}
	});
	window.dateInputPolyfill = {
		registerDateInput
	}
})();
