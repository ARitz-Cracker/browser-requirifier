(() => {
	document.addEventListener("input", ev => {
		/**@type {HTMLInputElement} */
		const range = ev.target;
		if(!(range instanceof HTMLInputElement) || range.type !== "range"){
			return;
		}
		const minVal = range.min == "" ? 0 : Number(range.min);
		const maxVal = range.max == "" ? 100 : Number(range.max);
		const curVal = range.valueAsNumber;
		range.style.setProperty(
			'--range-workaround-fill-amount',
			(curVal - minVal) / (maxVal - minVal)
		);
	}, {passive: true});
})();