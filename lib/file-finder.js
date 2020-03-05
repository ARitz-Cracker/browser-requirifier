const path = require("path");
const semver = require('semver')
const fs = require("fs");
const fsp = fs.promises;
const defaultPackageIncludes = require("./default-package-includes.json");



const generateJsFileList = async function(cwd, fileList, excludedFiles){
	let result = [];
	for(let i = 0; i < fileList.length; i += 1){
		const fullPath = path.resolve(cwd, fileList[i]);
		if(excludedFiles[fullPath]){
			continue;
		}
		try{
			const filesInFolder = await fsp.readdir(fullPath);
			result = result.concat(
				await generateJsFileList(fullPath, filesInFolder, excludedFiles)
			)
		}catch(ex){
			if(ex.code !== "ENOTDIR"){
				throw ex;
			}
			if(fullPath.endsWith(".json") || fullPath.endsWith(".js")){
				result.push(fullPath);
			}
		}
	}
	return result;
}

const generateVerbatimFileList = async function(cwd, fileList, excludedFiles){
	let result = [];
	for(let i = 0; i < fileList.length; i += 1){
		const fullPath = path.resolve(cwd, fileList[i]);
		if(excludedFiles[fullPath]){
			continue;
		}
		try{
			const filesInFolder = await fsp.readdir(fullPath);
			result = result.concat(
				await generateVerbatimFileList(fullPath, filesInFolder, excludedFiles)
			)
		}catch(ex){
			if(ex.code !== "ENOTDIR"){
				throw ex;
			}
			result.push(fullPath);
		}
	}
	return result;
}

const addDependency = async function(name, condition, includedDependencies, cwd){
	// Lazily check for git URLs and the like
	if(condition.indexOf("://") >= 0){
		condition = ">=0.0.0";
	}
	// const modulePaths = module.paths;
	const modulePaths = [
		cwd + "/node_modules"
	];
	let pathI = cwd.lastIndexOf(path.sep);
	while(pathI >= 0){
		cwd = cwd.substring(0, pathI);
		modulePaths.push(cwd + path.sep + "node_modules");
		pathI = cwd.lastIndexOf(path.sep);
	}
	if(process.platform === "win32"){
		modulePaths.push(process.env.APPDATA + "\\npm\\node_modules");
		modulePaths.push(process.env.PROGRAMFILES + "\\nodejs\\node_modules");
	}else{
		modulePaths.push(process.env.HOME + "/.node_modules");
		modulePaths.push("/usr/lib/node");
		modulePaths.push("/usr/lib/node_modules");
	}

	for(let i = 0; i < modulePaths.length; i += 1){
		const modulePath = modulePaths[i] + path.sep + name;
		let moduleData;
		try{
			moduleData = JSON.parse(
				await fsp.readFile(modulePath + path.sep + "package.json", "utf8")
			);
		}catch(ex){
			if(ex.code === "ENOENT"){
				continue;
			}
			throw ex;
		}
		if(!semver.satisfies(moduleData.version, condition)){
			continue;
		}
		if(
			// Check major verison with what we already have
			includedDependencies[name] != null &&
			includedDependencies[name].version.substring(0, includedDependencies[name].version.indexOf(".")) !==
				moduleData.version.substring(0, moduleData.version.indexOf("."))
		){
			throw new Error("Your project contains dependencies which have incompatible dependencies. " +
				name + " " + moduleData.version + " !^" + includedDependencies[name].version);
		}
		if(
			includedDependencies[name] != null &&
			semver.lte(moduleData.version, includedDependencies[name].version)
		){
			continue;
		}
		moduleData.browserRequirifier = moduleData.browserRequirifier ||
			defaultPackageIncludes[name] || {};
		
		if(moduleData.browserRequirifier.include == null){
			console.error("WARNING! " + name + "/" + moduleData.version + " doesn't have browserRequirifier.include set! All *.js and *.json files will be included and you probably don't want that!");
			moduleData.browserRequirifier.include = await fsp.readdir(modulePath);
			let i = moduleData.browserRequirifier.include.indexOf("package.json");
			if (i >= 0){
				moduleData.browserRequirifier.include.splice(i, 1);
			}
			i = moduleData.browserRequirifier.include.indexOf(moduleData.main);
			if (i >= 0){
				moduleData.browserRequirifier.include.splice(i, 1);
			}
			i = moduleData.browserRequirifier.include.indexOf(moduleData.main + ".js");
			if (i >= 0){
				moduleData.browserRequirifier.include.splice(i, 1);
			}
		}
		moduleData.browserRequirifier.exclude = moduleData.browserRequirifier.exclude || ["test", "tests"];
		moduleData.browserRequirifier.verbatim = moduleData.browserRequirifier.verbatim  || [];
		moduleData.browserRequirifier.excludedDependencies = moduleData.browserRequirifier.excludedDependencies || [];

		// Here we actually start importing the module
		const excludedFiles = {};
		moduleData.browserRequirifier.exclude.forEach((file) => {
			excludedFiles[path.resolve(modulePath, file)] = true;
		});
		if(includedDependencies[name]){
			console.log("Found better dependency " + name + "/" + moduleData.version);
		}else{
			console.log("Found dependency " + name + "/" + moduleData.version);
		}

		const include = await generateJsFileList(modulePath, moduleData.browserRequirifier.include, excludedFiles);
		const mainModule = path.resolve(modulePath, moduleData.browser || moduleData.main);
		const doubleIncluded = include.indexOf(mainModule);
		if(doubleIncluded >= 0){
			include.splice(doubleIncluded, 1);
		}

		includedDependencies[name] = {
			version: moduleData.version,
			modulePath,
			main: mainModule,
			include,
			verbatim: await generateVerbatimFileList(modulePath, moduleData.browserRequirifier.verbatim, excludedFiles)
		}
		const excludedDependencies = {};
		moduleData.browserRequirifier.excludedDependencies.forEach((val) => {
			excludedDependencies[val] = true;
		});
		for(const dependency in moduleData.dependencies){
			if(excludedDependencies[dependency]){
				continue;
			}
			await addDependency(dependency, moduleData.dependencies[dependency], includedDependencies, modulePath);
		}
	}
	if(includedDependencies[name] == null){
		throw new Error("Unable to find compatible module: " + name + "/" + condition);
	}
}

const generateFileList = async function(basePath = process.cwd()){
	const requirifierConfig = JSON.parse(
		await fsp.readFile(basePath + path.sep + "browser-requirifier-config.json")
	);
	if(!requirifierConfig.baseURL.endsWith("/")){
		throw new Error("baseURL config option must end with \"/\"");
	}
	let packageDataExists = false;
	let packageData;
	try{
		packageData = JSON.parse(
			await fsp.readFile(basePath + path.sep + "package.json")
		);
		packageDataExists = true;
	}catch(ex){
		if(ex.code === "ENOENT"){
			console.error("WARNING! No package.json found! You better make sure your dependencies are in order");
			packageData = {
				dependencies: {}
			};
			packageData.dependencies = {};
		}else{
			throw ex;
		}
	}
	
	const excludedFiles = {};
	(requirifierConfig.excludedFiles.exclude || []).forEach((file) => {
		excludedFiles[path.resolve(basePath, file)] = true;
	});
	
	const result = {
		outputDir: path.resolve(basePath, requirifierConfig.outputDir) + path.sep,
		baseURL: requirifierConfig.baseURL,
		basePath,
		moduleList: {},
	}

	for(const listName in requirifierConfig.moduleList){
		const moduleList = requirifierConfig.moduleList[listName];
		const moduleListLists = {
			include: await generateJsFileList(basePath, moduleList.includedFiles, excludedFiles),
			verbatim: await generateVerbatimFileList(basePath, moduleList.copyVerbatim || [], excludedFiles),
			mainModule: moduleList.startPoint,
			dependencies: {}
		};
		for(let i = 0; i < moduleList.dependencies.length; i += 1){
			const dependency = moduleList.dependencies[i];
			if(packageData.dependencies[dependency] == null && packageDataExists){
				console.error("WARNING! Your config references \"" + dependency + "\" as a dependency, but it's not listed in your package.json!")
			}
			const version = packageData.dependencies[dependency] || ">=0.0.0";
			await addDependency(dependency, version, moduleListLists.dependencies, basePath);
		}
		result.moduleList[listName] = moduleListLists;
	}
	return result;
}
module.exports = {generateFileList};
