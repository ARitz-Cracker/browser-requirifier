HTMLImageElement.prototype.decode = function(){
	if(this.complete){
		if(!this.naturalWidth){
			return Promise.reject(new DOMException("Invalid encoded image data."));
		}
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		this.addEventListener("load", (ev) => {
			resolve();
		}, {once: true});
		this.addEventListener("error", (ev) => {
			console.error("HTMLImageElement.prototype.decode polyfill:", ev);
			reject(new DOMException("Invalid encoded image data."));
		}, {once: true});
	});
};
