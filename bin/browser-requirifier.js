#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
let moduleListOutputStream;
const writeAndWait = async function(stream, data){
	return new Promise((resolve, reject) => {
		if(stream.write(data)){
			resolve();
		}else{
			stream.once("error", reject);
			stream.once("drain", () => {
				stream.off("error", reject);
				resolve();
			});
		}
	});
}
const removeDirectoryContents = async function(dir){
	const files = await fsp.readdir(dir);
	for(let i = 0; i < files.length; i += 1){
		try{
			await fsp.unlink(dir + path.sep + files[i]);
		}catch(ex){
			if(ex.code !== "EISDIR" && ex.code !== "EPERM"){
				throw ex;
			}
			await removeDirectoryContents(dir + path.sep + files[i]);
			await fsp.rmdir(dir + path.sep + files[i]);
		}
	}
}
const addModuleDefinition = function(o){
	return writeAndWait(moduleListOutputStream, "\t" + JSON.stringify(o, null, "\t").replace(/\n/g, "\n\t") + ",\n")
}
const stringEscapeSquences = function(str){
	return str
		.replace(/\\/g, "\\\\")
		.replace(/\"/g, "\\\"")
		.replace(/[\x00-\x1f]/g, (match) => {
			// Not anyone would do this, but file names can contain control characters in Linux
			return "\\x" + match.charCodeAt(0).toString(16).padStart(2, "0");
		});
}
let configOptions;
const isExcluded = {
	"node_modules/browser-requirifier": true
};
const currentDirectory = path.resolve(".");
const unixifyPath = function(filePath){
	return filePath.replace(RegExp("\\" + path.sep, "g"), "/");
}
const readJSONIfExists = async function(path){
	try{
		return JSON.parse(
			await fsp.readFile(path, "utf8")
		);
	}catch(ex){
		if(ex.code === "ENOENT"){
			return null;
		}
		throw ex;
	}
}

const removeItemFromArray = function(array, value){
	const index = array.indexOf(value);
	if(index !== -1){
		array.splice(index, 1);
	}
}
const fileExists = async function(path){
	try{
		await fsp.access(path);
		return true;
	}catch(ex){
		return false;
	}
}

const correctMainFileName = async function(dir, filename){
	if(!await fileExists(dir + path.sep + filename)){
		if(await fileExists(dir + path.sep + filename + ".js")){
			filename += ".js";
		}else if(await fileExists(dir + path.sep + filename + ".json")){
			filename += ".json";
		}else{
			throw new Error("Main module file in " + path + " is inaccessable");
		}
	}
	return filename;
}

const includeDirectory = async function(dir, aliasesForIndexFile = []){
	
	aliasesForIndexFile.push(dir);
	const relativePath = dir.substring(currentDirectory.length + 1);
	await fsp.mkdir(configOptions.outputDir + path.sep + relativePath);
	const packageOptions = await readJSONIfExists(dir + path.sep + "package.json");
	if(packageOptions == null){
		// console.log("dir:", dir);
		const files = await fsp.readdir(dir);
		removeItemFromArray("index.js");
		removeItemFromArray("index.json");
		await includeFile(dir + path.sep + "index.js", aliasesForIndexFile); // Does nothing if doesn't exist
		await includeFile(dir + path.sep + "index.json", aliasesForIndexFile); // Does nothing if doesn't exist
		for(let i = 0; i < files.length; i += 1){
			await includeFile(dir + path.sep + files[i]);
		}
	}else{
		// console.log("package:", dir);
		packageOptions.main = await correctMainFileName(dir, packageOptions.main);
		if(packageOptions.browser){
			packageOptions.browser = await correctMainFileName(dir, packageOptions.browser);
		}
		let mainFile = packageOptions.browser || packageOptions.main;
		if(packageOptions.browserRequirifierVerbatim != null){
			for(let i = 0; i < packageOptions.browserRequirifierVerbatim.length; i += 1){
				await copyVerbatim(dir + path.sep + packageOptions.browserRequirifierVerbatim[i]);
			}
		}
		if(packageOptions.browserRequirifierExclude == null && packageOptions.browserRequirifierInclude == null){
			console.error("WARNING: " + packageOptions.name + " doesn't have the browserRequirifier properties defined! You better be excluding files you don't need yourself");
		}
		if(packageOptions.browserRequirifierExclude != null){
			for(let i = 0; i < packageOptions.browserRequirifierExclude.length; i += 1){
				isExcluded[path.resolve(dir + path.sep + packageOptions.browserRequirifierExclude[i])] = true;
			}
		}
		if(packageOptions.browserRequirifierInclude == null){
			packageOptions.browserRequirifierInclude = await fsp.readdir(dir);
			// Only include package.json if the package explicitly wants it
			removeItemFromArray(packageOptions.browserRequirifierInclude, "package.json");
		}
		const files = packageOptions.browserRequirifierInclude;
		removeItemFromArray(files, packageOptions.main);
		removeItemFromArray(files, packageOptions.browser);
		await includeFile(dir + path.sep + mainFile, aliasesForIndexFile);
		for(let i = 0; i < files.length; i += 1){
			await includeFile(dir + path.sep + files[i]);
		}
	}
	
}
const includeFile = async function(filePath, aliases = []){
	try{
		if(isExcluded[filePath]){
			return;
		}

		// Remove this block of code when https://github.com/nodejs/node/issues/31583 is fixed
		const stat = await fsp.stat(filePath);
		if(stat.isDirectory()){
			return includeDirectory(filePath, aliases);
		}

		const relativePath = filePath.substring(currentDirectory.length + 1);
		const inputFile = await new Promise((resolve, reject) => {
			const stream = fs.createReadStream(filePath);
			// This is here to catch the "EISDIR" and "ENOENT" errors
			stream.once("error", reject);
			stream.once("ready", () => {
				stream.off("error", reject);
				resolve(stream);
			});
		});
		if(!relativePath.endsWith(".js") && !relativePath.endsWith(".json")){
			// The thing is, we catch if the file is a directory. Cancel the stream if it's not a js or json file
			inputFile.on("data", Function.prototype);
			inputFile.destroy();
			return;
		}
		let isJSON = false;
		if(relativePath.endsWith(".json")){
			isJSON = true;
			relativePath = relativePath.substring(0, relativePath.length - 4) + "js";
		}
		const outputFile = fs.createWriteStream(path.resolve(configOptions.outputDir) + path.sep + relativePath);

		let filename = configOptions.baseURL + unixifyPath(relativePath);
		const dirname = filename.substring(0, filename.lastIndexOf("/"));
		for(let i = 0; i < aliases.length; i += 1){
			aliases[i] = configOptions.baseURL + unixifyPath(aliases[i].substring(currentDirectory.length + 1));
		}
		aliases.push(filename);
		aliases.push(filename.substring(0, filename.length - 3)); // file and file.js both resolve to file.js
		await Promise.all([
			addModuleDefinition({
				url: filename,
				requireNames: aliases,
				filename,
				dirname
			}),
			(async () => {
				await writeAndWait(outputFile, "globalThis.requirifierModuleDefinitions[\"" +
					stringEscapeSquences(filename) +
					"\"] = function(require, module, __dirname, __filename){let exports" +
					(isJSON ? "=" : ";")
				);
				// console.log(inputFile.path, "->", outputFile.path);
				inputFile.pipe(outputFile, {end: false});
				await new Promise((resolve) => {
					inputFile.once("close", resolve);
				});
				outputFile.end("\n;module.exports = exports || module.exports || null;}\n");
			})()
		]);
	}catch(ex){
		// console.log("ERRORRRRRRRRRRRRR debug:", filePath, ex.name, ex.message);
		if(ex.code === "EISDIR"){
			await includeDirectory(filePath, aliases);
		}else if(ex.code !== "ENOENT" && ex.message !== "Not json or js"){
			throw ex;
		}
	}
}

const includeDependencyModuleDependents = async function(includedFiles, alreadyIncludedModules, modulesToCheckOut, donutPush = false){
	for(let i = 0; i < modulesToCheckOut.length; i += 1){
		const moduleDir = modulesToCheckOut[i];
		if(alreadyIncludedModules[moduleDir]){
			continue;
		}
		alreadyIncludedModules[moduleDir] = true;
		const packageData = await readJSONIfExists(path.resolve(moduleDir + "/package.json"));
		if(packageData == null){
			continue; // Module not found. Probably an optional dependency, or a bundeled dependency
		}
		const dependencyList = [];
		for(const name in packageData.dependencies){
			dependencyList.push("node_modules/" + name);
		}
		for(const name in packageData.peerDependencies){
			dependencyList.push("node_modules/" + name);
		}
		for(const name in packageData.optionalDependencies){
			dependencyList.push("node_modules/" + name);
		}
		await includeDependencyModuleDependents(includedFiles, alreadyIncludedModules, dependencyList)
		if(!donutPush){
			includedFiles.push(moduleDir);
		}
	}
}
const includeDependencies = async function(includedFiles){
	const alreadyIncludedModules = {};
	let modulesToCheckOut = [];
	for(let i = 0; i < includedFiles.length; i += 1){
		const includedFile = includedFiles[i];
		if(!includedFile.startsWith("node_modules/")){
			continue;
		}
		if(includedFile.indexOf("/", 13) !== -1){
			// User has already defined the specific files they need from this module
			alreadyIncludedModules[includedFile.substring(0, includedFile.indexOf("/", 13))] = true;
			continue;
		}
		if(alreadyIncludedModules[includedFile]){
			continue;
		}
		modulesToCheckOut.push(includedFile);
	}
	await includeDependencyModuleDependents(includedFiles, alreadyIncludedModules, modulesToCheckOut, true);
}

const copyVerbatim = async function(resolvedFilePath){
	const relativePath = resolvedFilePath.substring(currentDirectory.length);
	try{
		const files = await fsp.readdir(resolvedFilePath);
		await fsp.mkdir(configOptions.outputDir + relativePath);
		for(let i = 0; i < files.length; i += 1){
			await copyVerbatim(resolvedFilePath + path.sep + files[i]);	
		}
	}catch(ex){
		if(ex.code === "ENOTDIR"){
			await fsp.copyFile(resolvedFilePath, configOptions.outputDir + relativePath);
		}
	}
	//configOptions.outputDir + path.sep
}

const main = async function(){
	try{
		configOptions = JSON.parse(await fsp.readFile("browser-requirifier-config.json", "utf8"));
		if(!configOptions.baseURL.endsWith("/")){
			throw new Error("baseURL config option must end with \"/\"");
		}
		// TODO: We should probably only update files that have been changed, but that would require keeping track of files we no longer use, and I'm lazy
		await removeDirectoryContents(configOptions.outputDir);
		
		moduleListOutputStream = fs.createWriteStream(configOptions.outputDir + path.sep + "requirifier-module-list-main.js");
		await writeAndWait(moduleListOutputStream, "globalThis.requirifierModuleList = [\n");
		for(let i = 0; i < configOptions.excludedFiles.length; i += 1){
			isExcluded[path.resolve(configOptions.excludedFiles[i])] = true;
		}
		if(configOptions.moduleList.main.includedFiles.indexOf("node_modules") !== -1){
			console.error("WARNING: Unless this is a single-page app, you shouldn't include all your dependencies.");
			console.error("You only should include dependencies for the pages that need them!");
		}else{
			await fsp.mkdir(configOptions.outputDir + "/node_modules");
			await includeDependencies(configOptions.moduleList.main.includedFiles);
		}
		for(let i = 0; i < configOptions.moduleList.main.includedFiles.length; i += 1){
			// console.log("includedFile:", configOptions.moduleList.main.includedFiles[i]);
			await includeFile(path.resolve(configOptions.moduleList.main.includedFiles[i]));
		}
		if(configOptions.moduleList.main.copyVerbatim != null){
			for(let i = 0; i < configOptions.moduleList.main.copyVerbatim.length; i += 1){
				await copyVerbatim(path.resolve(configOptions.moduleList.main.copyVerbatim[i]));
			}
		}

		if(configOptions.moduleList.main.startPoint.endsWith(".js")){
			const startPoint = configOptions.moduleList.main.startPoint;
			configOptions.moduleList.main.startPoint = startPoint.substring(0, startPoint.length - 3);
		}
		moduleListOutputStream.end(
			"]\n" +
			"globalThis.requirifierMainModule = \"" + configOptions.baseURL + stringEscapeSquences(configOptions.moduleList.main.startPoint) + "\";\n" +
			"globalThis.requirifierBaseURL = \"" + configOptions.baseURL + "\";\n"
		);
		delete configOptions.moduleList.main;
		for(const name in configOptions.moduleList){
			moduleListOutputStream = fs.createWriteStream(configOptions.outputDir + path.sep + "requirifier-module-list-" + name + ".js");
			await writeAndWait(moduleListOutputStream, "globalThis.addRequirifierModules([\n");
			await includeDependencies(configOptions.moduleList[name].includedFiles);
			for(let i = 0; i < configOptions.moduleList[name].includedFiles.length; i += 1){
				await includeFile(path.resolve(configOptions.moduleList[name].includedFiles[i]));
			}
			if(configOptions.moduleList[name].copyVerbatim != null){
				for(let i = 0; i < configOptions.moduleList[name].copyVerbatim.length; i += 1){
					await copyVerbatim(path.resolve(configOptions.moduleList[name].copyVerbatim[i]));
				}
			}
			if(configOptions.moduleList[name].startPoint.endsWith(".js")){
				const startPoint = configOptions.moduleList[name].startPoint;
				configOptions.moduleList[name].startPoint = startPoint.substring(0, startPoint.length - 3);
			}
			moduleListOutputStream.end(
				"],\n" +
				"\"" + configOptions.baseURL + stringEscapeSquences(configOptions.moduleList[name].startPoint) + "\");\n"
			);
		}

		await fsp.copyFile(__dirname + "/../files-to-copy/requirifier-init.js", configOptions.outputDir + path.sep + "requirifier-init.js")
		console.log("done!");
	}catch(ex){
		console.error(ex.stack);
	}
}
main();
