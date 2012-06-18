define(function() {

	var ResourceManager = Object.create(Object, {

    	// errors
    	MISSING_DESCRIPTION: { value: "MISSING_DESCRIPTION" },
    	INVALID_PATH: { value: "INVALID_PATH" },
    	INVALID_TYPE: { value: "INVALID_TYPE" },
    	XMLHTTPREQUEST_STATUS_ERROR: { value: "XMLHTTPREQUEST_STATUS_ERROR" },
    	NOT_FOUND: { value: "NOT_FOUND" },

    	// misc constants
    	ARRAY_BUFFER: { value: "ArrayBuffer" },

    	_resources: { value: null, writable: true },
        
    	//manage entries
    	_containsResource: {
        	enumerable: false,
       	 	value: function(resourceID) {
            	return this._resources[resourceID] ? true : false;
        	}
    	},
    
	    init: {
    	    value: function() {
        	    this._resources = {};
           	 	this._resourcesToBeProcessed = [];
        	}
    	},
    
	    _storeResource: {
    	    enumerable: false,
        	value: function(resourceID, resource) {
            	if (!resourceID) {
	                console.log("ERROR: entry does not contain id, cannot store");
    	            return;
        	    }
        
            	if (this._containsResource[resourceID]) {
                	console.log("WARNING: resource:"+resourceID+" is already stored, overriding");
            	}
            
 	           this._resources[resourceID] = resource;
       	 	}
    	},
    
    	_getResource: {
        	enumerable: false,
        	value: function(resourceID) {
            	return this._resources[resourceID];
        	}
    	},
    
	    // items that are currently being processed
    	_resourceBeingProcessed: { value: null, writable: true },
    
    	_resourcesToBeProcessed: { value: null, writable: true },
    
   	 	_loadResource: {
        	value: function(delegate, range) {

            	var self = this;
            	var description = this._resourceBeingProcessed.resourceDescription.description;
            
	            if (!description.type) {
    	            delegate.handleError(ResourceManager.INVALID_TYPE, null);
        	        return;
            	}
            	if (description.type === this.ARRAY_BUFFER) {
                	if (!description.path) {
                    	delegate.handleError(ResourceManager.INVALID_PATH);
                    	return;
                	}
                    
    	            var xhr = new XMLHttpRequest();
                
  	              xhr.open('GET', description.path, true);
    	            xhr.responseType = 'arraybuffer';
        	        if (range) {
            	        var header = "bytes=" + range[0] + "-" + range[1];
               	     	xhr.setRequestHeader("Range", header);
                	}
               		//if this is not specified, 1 "big blob" scenes fails to load.
                	xhr.setRequestHeader("If-Modified-Since", "Sat, 1 Jan 1970 00:00:00 GMT");                                                
                	xhr.onload = function(e) {
                    	if ((this.status == 200) || (this.status == 206)) {
                        	self._resource = this.response; 
                        	delegate.resourceAvailable(self._resource);
                    	} else {
                        	delegate.handleError(ResourceManager.XMLHTTPREQUEST_STATUS_ERROR, this.status);
                    	}
                	};
                	xhr.send(null);
 	                   
    	        } else {
        	        delegate.handleError(ResourceManager.INVALID_TYPE, description.type);
            	}
        	}
    	},
    
	    /* 
    	    process the queue of resources one at a time and pick them in "_resourcesToBeProcessed" 
        	this method should be cleaned up a bit. dequeuing code is redundant.
        
        	FIXME: make sure to check with resource id / url before putting it again in the queue again
    	*/
    	_processResource: {
        	value: function(resourceToBeProcessed) {

            	var delegate = resourceToBeProcessed["delegate"];
            	var description = resourceToBeProcessed["resourceDescription"];
            	var range = resourceToBeProcessed["range"];
            	var ctx = resourceToBeProcessed["ctx"];
            	var id = resourceToBeProcessed["id"];
            
            	if (delegate) {
                	var self = this;
                	var processResourceDelegate = {};
                
	                processResourceDelegate.resourceAvailable = function(resource) {
    	                var resourceDescription = resourceToBeProcessed.resourceDescription;
                    
        	            // ask the delegate to convert the resource, typically here, the delegate is the renderer and will produce a webGL array buffer
            	        // this could get more general and flexbile by make an unique key with the id from the resource + the converted type (day "ARRAY_BUFFER" or "TEXTURE"..)
                	    //, but as of now, this flexibily does not seem necessary.
                    	// console.log("call convert for:"+resourceDescription.id);
                    	convertedResource = delegate.convert(resource, ctx);
                    	self._storeResource(id, convertedResource);
                    	delegate.resourceAvailable(convertedResource, ctx);
                    	this._resourceBeingProcessed = null;

                    	//process next element
                    	if (self._resourcesToBeProcessed.length > 0) {
                        	var nextResourceToBeProcessed = self._resourcesToBeProcessed.pop();
                        	self._processResource(nextResourceToBeProcessed);
                    	}
                	}
                
                	processResourceDelegate.handleError = function(errorCode, info) {
                    	delegate.handleError(errorCode, info);
                	}
            
	                if (!description) {
    	                delegate.handleError(ResourceManager.MISSING_DESCRIPTION);
        	        }
                
            	    var resource = self._getResource(id);
                	if (resource) {
//                    this._resourceBeingProcessed = resourceToBeProcessed;
                    	delegate.resourceAvailable(resource, ctx);

	                    this._resourceBeingProcessed = null;
                    
    	                if (self._resourcesToBeProcessed.length > 0) {
        	                var nextResourceToBeProcessed = self._resourcesToBeProcessed.pop();
            	            self._processResource(nextResourceToBeProcessed);
                	    }
                    
	                } else {
    	                this._resourceBeingProcessed = resourceToBeProcessed;
        	            this._loadResource(processResourceDelegate, range);
            	    }
            	}
        	}
    	},

	    removeAllResources: {
    	    value: function() {
        	    this._resources = {};
        	}
    	},

    	getWebGLResource: {
        	value: function(id, resourceDescription, range, delegate, ctx) {

            	var resource = this._getResource(id);
            	if (resource) {
                	delegate.resourceAvailable(resource, ctx);
                	return resource;
            	} else {
                	var resourceToBeProcessed = {   "resourceDescription" : resourceDescription , 
                    	                            "delegate" : delegate,
                        	                        "ctx" : ctx,
                            	                    "range" : range,
                                	                "id" : id  };

	                if (this._resourceBeingProcessed) {
    	                this._resourcesToBeProcessed.push(resourceToBeProcessed);
        	        } else {
            	        this._processResource(resourceToBeProcessed);
                	}       
	            }
    	        return null;                 
        	}
   	 	}
	});
	
		return ResourceManager;
	}
);
