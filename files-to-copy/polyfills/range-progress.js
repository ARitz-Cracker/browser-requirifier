(() => {
	const originalInputDescriptor = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"valueAsNumber"
	);
	const doTheWorkaround = function(/**@type {HTMLInputElement}*/ range, curVal = range.valueAsNumber){
		if(!(range instanceof HTMLInputElement) || range.type !== "range"){
			return;
		}
		const minVal = range.min == "" ? 0 : Number(range.min);
		const maxVal = range.max == "" ? 100 : Number(range.max);
		range.style.setProperty(
			'--range-workaround-fill-amount',
			(curVal - minVal) / (maxVal - minVal)
		);
	}
	const rangeProgressWorkaroundApplied = Symbol("rangeProgressWorkaroundApplied");
	const registerRangeProgress = function(/**@type {HTMLInputElement}*/ elem){
		if(elem[rangeProgressWorkaroundApplied] || !(elem instanceof HTMLInputElement) || elem.type != "range"){
			return;
		}
		Object.defineProperty(elem, "value", {
			set: (val) => {
				val = Number(val);
				if(isNaN(val)){
					const minVal = range.min == "" ? 0 : Number(range.min);
					const maxVal = range.max == "" ? 100 : Number(range.max);
					val = Math.round((minVal + maxVal) / 2);
				}
				doTheWorkaround(elem, val);
				originalInputDescriptor.set.call(elem, val);
			},
			get:() => {
				return String(originalInputDescriptor.get.call(elem));
			}
		});
		Object.defineProperty(elem, "valueAsNumber", {
			set: (val) => {
				val = Number(val);
				if(isNaN(val)){
					const minVal = range.min == "" ? 0 : Number(range.min);
					const maxVal = range.max == "" ? 100 : Number(range.max);
					val = Math.round((minVal + maxVal) / 2);
				}
				doTheWorkaround(elem, val);
				originalInputDescriptor.set.call(elem, val);
			},
			get:() => {
				return originalInputDescriptor.get.call(elem);
			}
		});

		elem[rangeProgressWorkaroundApplied] = true;
	}
	document.addEventListener("input", ev => {
		doTheWorkaround(ev.target);
		registerRangeProgress(ev.target); // Just in case
	}, {passive: true});
	window.rangeProgressWorkaround = {
		registerRangeProgress
	};
})();
