(() => {
const resolveMaps = {}
const resolvePath = function(path){
	if(path.endsWith("/")){
		path = path.substring(0, path.length - 1);
	}
	path = path.replace(/\/\.\//g, "/");
	while(path.indexOf("/../") !== -1){
		path = path.replace(/(^|\/)[^\/]*?\/\.\.\/(.*?)($|\/)/, (match, p1, newDir, p3) => {
			return p1 + newDir + p3;
		});
		if(path.startsWith("../")){
			throw new Error("You're going too far up");
		}
	}
	while(path.endsWith("/..")){
		path = path.substring(0, path.lastIndexOf("/", path.length - 3));
	}
	return resolveMaps[path] || path;
}
const loadedJavascripts = {};
const loadJavascript = function(url){
	if(loadedJavascripts[url] == null){
		loadedJavascripts[url] = new Promise((resolve, reject) => {
			const element = document.createElement("script");
			element.async = true;
			element.onload = () => {
				loadedJavascripts[url] = true;
				resolve(true);
			};
			element.onerror = (e) => {
				//TODO: e is an EVENT not an error!!
				//alert(inspect(e));
				reject(new Error("File could not be loaded: " + url));
			};
			element.src = url;
			document.getElementsByTagName("head")[0].appendChild(element);
		});
	}
	return loadedJavascripts[url];
}
globalThis.requirifierModuleDefinitions = {};
const moduleMainMainFuncs = {};
const cachedModuleResults = {};
const requireModule = function(moduleName, parentFile){
	let searchIndex = parentFile.lastIndexOf("/node_modules/");
	let moduleFile = globalThis.requirifierBaseURL + "node_modules/" + moduleName;
	if(searchIndex === -1){
		if(resolveMaps[moduleFile] === undefined){
			throw new Error("Module " + moduleName + " not found!");
		}
		return requireAbsolute(resolveMaps[moduleFile], parentFile);
	}
	moduleFile = parentFile.substring(0, searchIndex + 14) + moduleName;
	while(moduleMainMainFuncs[resolveMaps[moduleFile]] == null){
		searchIndex = moduleFile.lastIndexOf("/node_modules/", searchIndex);
		if(searchIndex === -1){
			throw new Error("Module " + moduleName + " not found!");
		}
		moduleFile = moduleFile.substring(0, searchIndex + 14) + moduleName;
	}
	if(resolveMaps[moduleFile] === undefined){
		throw new Error("Module " + moduleName + " not found!");
	}
	return requireAbsolute(resolveMaps[moduleFile]);
}
const requireAbsolute = function(resolvedPath, parentFile){
	// Modules export null when exports are undefined
	if(cachedModuleResults[resolvedPath] === undefined){
		if(typeof moduleMainMainFuncs[resolvedPath] !== "function"){
			throw new Error("Module " + resolvedPath + " not found!");
		}
		cachedModuleResults[resolvedPath] = moduleMainMainFuncs[resolvedPath](parentFile);
	}
	return cachedModuleResults[resolvedPath];
}
const addNewModuleDefinitions = async function(moduleList, polyfillTests){
	const polyfillPromises = [];
	for (const polyfillName in polyfillTests){
		if((new Function(polyfillTests[polyfillName]))()){
			polyfillPromises.push(loadJavascript(globalThis.requirifierBaseURL + "requirifier-polyfills/" + polyfillName + ".js"));
		}
	}
	await Promise.all(polyfillPromises);
	await Promise.all(moduleList.map((moduleProperties) => {
		return loadJavascript(moduleProperties.url);
	}));
	for(let i = 0; i < moduleList.length; i += 1){
		const moduleProperties = moduleList[i];
		const reqFunc = (modPath) => {
			if(modPath.startsWith("/")){
				return requireAbsolute(resolveMaps[modPath], moduleProperties.filename);
			}else if(modPath.startsWith("./") || modPath.startsWith("../")){
				return requireAbsolute(resolvePath(moduleProperties.dirname + "/" + modPath), moduleProperties.filename);
			}else if(modPath.startsWith(globalThis.requirifierBaseURL)){
				return requireAbsolute(resolvePath(modPath), moduleProperties.filename);
			}else{
				return requireModule(modPath, moduleProperties.filename);
			}
		}
		Object.defineProperties(reqFunc, {
			cache: {
				configurable: false,
				value: cachedModuleResults,
				writable: false
			},
			resolve: {
				configurable: false,
				value: resolvePath,
				writable: false
			},
			main: {
				configurable: false,
				get: () => {
					throw new Error("require.main isn't accessable in this context")
				},
				set: () => {
					throw new Error("require.main isn't accessable in this context")
				}
			},
		});
		const moduleMain = (parentFile) => {
			const modObj = {};
			Object.defineProperties(modObj, {
				children: {
					configurable: false,
					get: () => {
						throw new Error("modules.children isn't accessable in this context")
					},
					set: () => {
						throw new Error("modules.children isn't accessable in this context")
					}
				},
				exports: {
					configurable: false,
					value: {},
					writable: true
				},
				parent: {
					configurable: false,
					value: parentFile,
					writable: false
				},
				paths: {
					configurable: false,
					get: () => {
						throw new Error("modules.paths isn't accessable in this context")
					},
					set: () => {
						throw new Error("modules.paths isn't accessable in this context")
					}
				},
				require: {
					configurable: false,
					get: () => {
						throw new Error("modules.require isn't accessable in this context")
					},
					set: () => {
						throw new Error("modules.require isn't accessable in this context")
					}
				},
				filename: {
					configurable: false,
					value: moduleProperties.filename,
					writable: false
				},
				id: {
					configurable: false,
					value: moduleProperties.filename,
					writable: false
				},
				browser: {
					configurable: false,
					value: true,
					writable: false
				}
			});
			globalThis.requirifierModuleDefinitions[moduleProperties.filename](
				reqFunc,
				modObj,
				moduleProperties.dirname,
				moduleProperties.filename
			);
			return modObj.exports;
		}
		for(let i = 0; i < moduleProperties.requireNames.length; i += 1){
			resolveMaps[moduleProperties.requireNames[i]] = moduleProperties.filename;
		}
		moduleMainMainFuncs[moduleProperties.filename] = moduleMain;
	}
}
let mainRequirifierResolve;
let mainRequirifierReject;
let mainRequirifierPromise = new Promise((resolve, reject) => {
	mainRequirifierResolve = resolve;
	mainRequirifierReject = reject;
});
globalThis.requirifierModulesLoaded = Promise.resolve(true);
document.addEventListener("DOMContentLoaded", async function(event) { 
	try{
		if(!Array.isArray(globalThis.requirifierModuleList)){
			throw new Error("Main module list not defined!");
		}
		await addNewModuleDefinitions(globalThis.requirifierModuleList, globalThis.requirifierPolyfills || {});
		requireAbsolute(resolveMaps[globalThis.requirifierMainModule], null);
		mainRequirifierResolve();
	}catch(ex){
		console.error(ex);
		mainRequirifierReject(ex);
		alert("Unable to load JavaScript modules. Some (or all) site features may not be available");
	}
});
globalThis.addRequirifierModules = async function(defs, startModule, polyfills = {}){
	let requirifierLoadedResolve;
	globalThis.requirifierModulesLoaded = new Promise((resolve) => {
		requirifierLoadedResolve = resolve;
	});
	await mainRequirifierPromise;
	try{
		await addNewModuleDefinitions(defs, polyfills);
		if(startModule){
			requireAbsolute(resolveMaps[startModule], null);
		}
		requirifierLoadedResolve(true);
	}catch(ex){
		console.error(ex);
		alert("Unable to load JavaScript modules. Some (or all) site features may not be available");
		requirifierLoadedResolve(false);
	}
	
}
// For all your REPL needs!
globalThis.require = function(id){
	if(id.startsWith("/")){
		return requireAbsolute(resolveMaps[id], null);
	}else{
		return requireAbsolute(resolveMaps[globalThis.requirifierBaseURL + "node_modules/" + id]);
	}
}
})();
