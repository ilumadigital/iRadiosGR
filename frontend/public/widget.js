(function() {
    var scripts = document.getElementsByTagName('script');
    
    for (var i = 0; i < scripts.length; i++) {
        var script = scripts[i];
        
        var stationId = script.getAttribute('data-station');
        var isProcessed = script.getAttribute('data-processed');
        
        if (stationId && !isProcessed) {
            script.setAttribute('data-processed', 'true');
            
            var container = document.createElement('div');
            container.style.width = "100%";
            container.style.maxWidth = "600px";
            container.style.aspectRatio = "1 / 1"; // Πάντα τέλειο τετράγωνο
            container.style.margin = "0 auto";
            container.style.borderRadius = "32px";
            container.style.overflow = "hidden";
            container.style.boxShadow = "0 20px 40px rgba(0,0,0,0.5)";
            container.style.backgroundColor = "#09090b";
            container.style.position = "relative";
            
            var iframe = document.createElement('iframe');
            iframe.src = "__IRADIOS_SITE_ORIGIN__/widget/" + stationId;
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";
            iframe.allow = "autoplay";
            
            container.appendChild(iframe);
            
            script.parentNode.insertBefore(container, script.nextSibling);
            
            break; 
        }
    }
})();
