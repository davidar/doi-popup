+function ($) {
    'use strict';

    var citeprocJsonMetadataParser = function(data) {
	// For now we are pulling links out of CrossRef citeproc
	// rather than the Link header. This will change when
	// CORS headers are fixed on data proxies.

	return {
	    title: data['title'],
	    licenses: data['license'],
	    authors: data['author'],
	    resources: data['link']
	};
    };

    var defaultContentTypeLabels = {
	'application/pdf': 'PDF',
	'text/html': 'HTML',
	'text/plain': 'Plain',
	'application/xml': 'XML',
	'text/xml': 'XML',
	'text/csv': 'CSV'
    };

    var defaultLicenseLabels = {
	'http://creativecommons.org/licenses/by/3.0' :
	'cc-by.svg',
	'http://creativecommons.org/licenses/by/3.0/':
	'cc-by.svg',
	'http://creativecommons.org/licenses/by/4.0':
	'cc-by.svg',
	'http://creativecommons.org/licenses/by/4.0/':
	'cc-by.svg',
    };

    var defaultContentGenerator = function(doi, metadata, options) {
	var $authorList = $('<ul class="list-inline">');
	var $resourceList = $('<ul class="list-inline">');
	var $licenseList = $('<ul class="list-inline">');

	if (metadata['authors']) {
	    $.each(metadata['authors'], function(i) {
		var a = metadata['authors'][i];
		if (a['ORCID']) {
		    var label;

		    if (a['given'] && a['family']) {
			label = a['given'] + ' ' + a['family'];
		    } else if (a['family']) {
			label = a['family'];
		    } else {
			label = a['ORCID'];
		    }
		    
		    var $a = $('<a>')
			.attr('href', a['ORCID'])
			.append($('<img>').attr('src', options.imageLocation + '/orcid_24x24.gif'))
			.append($('<span>').text(' ' + label));
		    $authorList.append($('<li>').append($a));
		}
	    });
	}

	if (metadata['resources']) {
	    $.each(metadata['resources'], function(i) {
		var r = metadata['resources'][i];
		if (r['URL']) {
		    var $a = $('<a>')
			.attr('href', r['URL'])
			.text(options.contentTypeLabels[r['content-type']]
			      || r['content-type']);
		    $resourceList.append($('<li>').append($a));
		}
	    });
	}

	if (metadata['licenses']) {
	    $.each(metadata['licenses'], function(i) {
		var l = metadata['licenses'][i];
		if (l['URL']) {
		    var $label;

		    if (options.licenseLabels[l['URL']]) {
			$label = $('<img>').attr('src',
						 options.imageLocation
						 + '/'
						 + options.licenseLabels[l['URL']]);
		    } else {
			$label = $('<span>').text(l['URL']);
		    }   
		    
		    var $a = $('<a>')
			.attr('href', l['URL'])
			.append($label);
		    $licenseList.append($('<li>').append($a));
		}
	    });
	}

	var $authors = $('<div>')
	    .append($('<span>').text('Authors'))
	    .append($authorList);

	var $resources = $('<div>')
	    .append($('<span>').text('Resources'))
	    .append($resourceList);

	var $licenses = $('<div>')
	    .append($('<span>').text('Licenses'))
	    .append($licenseList);

	var $c = $('<div>');

	$c.append($('<p style="font-size:1.2em;">').text(metadata['title']));
	$c.append($resourceList.addClass('pull-right'));
	$c.append($('<a>')
		  .attr('href', 'http://dx.doi.org/' + doi)
		  .append($('<img>')
			  .attr('src', 'https://assets.crossref.org/logo/crossref-logo-landscape-100.png')
			  .attr('style', 'height:20px; margin-right: 8px;'))
		  .append($('<span>').text(doi)));
	$c.append($('<hr>'));

	if (metadata['licenses'] && metadata['licenses'].length != 0) {
	    $c.append($('<div class="row" style="margin-bottom: 10px">')
		      .append($('<div class="col-md-2">').append($('<b>').text('Licenses')))
		      .append($('<div class="col-md-10">').append($licenseList)));
	}

	if (metadata['authors'] && metadata['authors'].length != 0) {
	    $c.append($('<div class="row">')
		      .append($('<div class="col-md-2">').append($('<b>').text('Authors')))
		      .append($('<div class="col-md-10">').append($authorList)));
	}

	return $c.html();
    };

    var DoiPopup = function (element, options) {
	this.init('doiPopup', element, options);

	var doi = this.getDoi();
	var o = this.options;

	$.ajax({
	    url: 'http://dx.doi.org/' + doi,
	    headers: {
		// Safari does not repeat this post redirect.
		'Accept': o.metadataContentType}
	}).success(function(data, status, xhr) {
	    // Needs Access-Control-Expose-Headers: Link
	    // https://github.com/thlorenz/parse-link-header
	    // We should merge link header links into metadata
	    var linkHeader = xhr.getResponseHeader('Link');
	    var metadata = o.metadataParser(data);

	    o.content = defaultContentGenerator(doi, metadata, o);
	    // TODO: invoke render
	});
    };

    if (!$.fn.tooltip) throw new Error('DoiPopup requires tooltip.js');

    DoiPopup.VERSION  = '1.0.0';

    DoiPopup.DEFAULTS = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, {
	doi: '',
	html: true,
	content: 'spinner',
	placement: 'bottom',
	imageLocation: 'img',
	trigger: 'click',
	metadataContentType: 'application/vnd.citationstyles.csl+json',
	metadataParser: citeprocJsonMetadataParser,
	licenseLabels: defaultLicenseLabels,
	contentTypeLabels: defaultContentTypeLabels,
	template: '<div style="max-width: 600px;" class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
    });

    DoiPopup.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype);
    
    DoiPopup.prototype.constructor = DoiPopup;

    DoiPopup.prototype.getDefaults = function () {
	return DoiPopup.DEFAULTS;
    };

    DoiPopup.prototype.setContent = function () {
	var $tip    = this.tip();
	var title   = this.getTitle();
	var content = this.getContent();

	$tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)
	$tip.find('.popover-content').children().detach().end()[
	    // we use append for html objects to maintain js events
	    this.options.html ? (typeof content == 'string' ? 'html' : 'append') : 'text'
	](content)

	$tip.removeClass('fade top bottom left right in');

	// IE8 doesn't accept hiding via the `:empty` pseudo selector, we have to do
	// this manually by checking the contents.
	if (!$tip.find('.popover-title').html()) {
	    $tip.find('.popover-title').hide();
	}
    };

    DoiPopup.prototype.hasContent = function () {
	return this.getDoi();
    };

    DoiPopup.prototype.getContent = function () {
	var $e = this.$element;
	var o  = this.options;

	return $e.attr('data-content')
	    || (typeof o.content == 'function' ?
		o.content.call(o.metadata) :
		o.content);
    };

    DoiPopup.prototype.getDoi = function () {
	var doi;
	var o = this.options;

	doi = o.doi
	    || $("meta[name='dc.identifier']").attr('content');

	return doi;
    };

    DoiPopup.prototype.arrow = function () {
	return (this.$arrow = this.$arrow || this.tip().find('.arrow'));
    };

    DoiPopup.prototype.tip = function () {
	if (!this.$tip) {
	    this.$tip = $(this.options.template);
	}
	
	return this.$tip;
    };

    function Plugin(option) {
	return this.each(function () {
	    var $this   = $(this);
	    var data    = $this.data('bs.doiPopup');
	    var options = typeof option == 'object' && option;
	    
	    if (!data && option == 'destroy') {
		return;
	    }
	    
	    if (!data) {
		$this.data('bs.doiPopup', (data = new DoiPopup(this, options)));
	    }
	    
	    if (typeof option == 'string') {
		data[option]();
	    }
	});
    }

    var old = $.fn.popover;

    $.fn.doiPopup             = Plugin;
    $.fn.doiPopup.Constructor = DoiPopup;
    
    $.fn.doiPopup.noConflict = function () {
	$.fn.doiPopup = old;
	return this;
    };
    
}(jQuery);
