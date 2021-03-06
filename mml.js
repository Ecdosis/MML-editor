/**
 * Remember where we are in a list of pages
 * @param ref the value of the milestone, e.g. "4" for page 4
 * @param loc the location in pixels or whatever units where the ms starts
 */
function RefLoc( ref, loc) {
    this.ref = ref;
    this.loc = loc;
}
/**
 * An MML Editor provides 3 panels which are sync-scrolled.
 * In the first panel there is a succession of page-images.
 * In the second an editable text in a minimal markup language (MML).
 * In the third a HTML preview generated from the editable text.
 * The MML diaclet is defined from a JSON opts object.
 * To use it just create one:
 * var editor = new MMLEditor(opts,dialect);
 * @param opts the options neede to run MMLEditor:
 * source: the ID of a textarea on the page (no leading "#")
 * target: the ID of an empty div element (no leading "#")
 * images: the ID of the div to receive the images
 * data: contains the keys 
 *      prefix - the prefix before each image name
 *      suffix: the suffix for each image name e.g. ".png"
 *      url: the url to fetch the images from
        desc: an array of ref, width and height keys for each image
 * @param dialect an MML dialect description in JSON format, see mml-dialect.md
 */
function MMLEditor(opts, dialect) {
    /** set to true when source altered, controls updating */
    this.changed = true;
    /** quote chars for smartquotes */
    this.quotes = {"'":1,"‘":1,"’":1,'"':1,'”':1,'“':1};
    /** number of lines in textarea source */
    this.num_lines = 0;
    /** flag to indicate if current para was foratted */
    this.formatted = false;
    /** flag to indicate when images have been loaded */
    this.imagesLoaded = false;
    /** page break RefLoc page starts in textarea (lines) */
    this.page_lines = new Array();
    /** page break RefLocs for html target */
    this.html_lines = new Array();
    /** page-breaks for images */
    this.image_lines = new Array();
    /** copy of options for MMLEditor */
    this.opts = opts;
    /** dialect file of MML */
    this.dialect = dialect;
    /**
     * This should be a function of Array
     * @param the Array to test
     * @return the last element of Array, which is NOT modified
     */
    this.peek = function( stack )
    {
        return (stack.length==0)?undefined:stack[stack.length-1];
    };
    /**
     * Make a generic divider. It is a table with four cells.
     * @param prop the class name of the table and cell properties
     * @return the HTML table with class names suitable for CSS
     */
    this.makeDivider = function( prop )
    {
        var sb = "";
        sb += '<table class="';
        sb += prop;
        sb += '" title="';
        sb += prop;
        sb += '"><tr><td class="';
        sb += prop;
        sb += '-lefttop">';
        sb += "</td>";
        sb += '<td class="';
        sb += prop;
        sb += '-righttop">';
        sb += "</td></tr>";
        sb += '<tr><td class="';
        sb += prop;
        sb += '-leftbot">';
        sb += "</td>";
        sb += '<td class="';
        sb += prop;
        sb += '-rightbot">';
        sb += "</td></tr>";
        sb += "</table>";
        return sb;
    };
    /**
     * Process a paragraph for possible dividers
     * @param text the text to process
     * @return the possibly modified text
     */
    this.processDividers = function(text)
    {
        if ( this.dialect.dividers!=undefined )
        {
            var divs = this.dialect.dividers;
            for ( var i=0;i<divs.length;i++ )
            {
                var div = divs[i];
                if ( text.trim() == div.tag )
                {
                    text = this.makeDivider( div.prop );
                    this.formatted = true;
                }
            }
        }
        return text;
    };
    /**
     * Get a curly close quote character 
     * @param quote the quote to convert
     * @return the Unicode curly variant
    */
    this.closeQuote = function( quote )
    {
        if ( quote=="'" )
            return "’";
        else if ( quote == '"' )
            return '”';
        else
            return quote;
    };
    /**
     * Get a curly opening quote character 
     * @param quote the quote to convert
     * @return the Unicode curly variant
    */
    this.openQuote = function( quote )
    {
        if ( quote=="'" )
            return "‘";
        else if ( quote == '"' )
            return '“';
        else
            return quote;
    };
    /**
     * Is this a curly or straight quote char?
     * @param c the quote to test
     * @return true if it is
     */
    this.isQuote= function( c )
    {
        return c in this.quotes;
    };
    /**
     * Is this a plain space char?
     * @param c the char to test
     * @return true if it is
     */
    this.isSpace = function( c )
    {
        return c == '\t'||c==' ';
    };
    /**
     * Is this an opening bracket of some kind?
     * @param c the char to test
     * @return true if it is
     */
    this.isOpeningBracket = function(c)
    {
        return c=='['||c=='('||c=='{'||c=='<';
    };
    /**
     * Specifically test for an opening quote char
     * @param c the char to test
     * @return true if it is
     */
    this.isOpeningQuote = function(c)
    {
        return c=="‘"||c=='“';
    };
    /**
     * Convert smart quotes as fast as possible. Do this first.
     * @param text the text of a paragraph
     * @return the modified text
     */
    this.processSmartQuotes = function( text )
    {
        if ( this.dialect.smartquotes )
        {
            for ( var i=0;i<text.length;i++ )
            {
                var c = text[i];
                if ( this.isQuote(c) )
                {
                    var prev = text[i-1];
                    if ( i==0||(this.isSpace(prev)
                        ||this.isOpeningQuote(prev)||this.isOpeningBracket(prev)) )
                        text = text.slice(0,i)+this.openQuote(c)+text.slice(i+1);
                    else
                        text = text.slice(0,i)+this.closeQuote(c)+text.slice(i+1);
                }
            }
        }
        return text;         
    };
    /**
     * Search for and replace all character formats in the paragraph
     * @param text the text of the paragraph
     * @return the possibly modified text with spans inserted
     */ 
    this.processCfmts = function(text)
    {
        if ( this.dialect.charformats != undefined )
        {
            var cfmts = this.dialect.charformats;
            var tags = new Array();
            var stack = new Array();
            for ( var k=0;k<cfmts.length;k++ )
            {
                var cfmt = cfmts[k];
                if ( cfmt.tag != undefined )
                    tags[cfmt.tag] = (cfmt.prop!=undefined)?cfmt.prop:cfmt.tag;
            }
            // add default soft-hyphens
            tags["-\n"] = "soft-hyphen";
            var i = 0;
            while ( i<text.length )
            {
                var c = text[i];
                for ( var tag in tags )
                {
                    var j;
                    for ( j=0;j<tag.length;j++ )
                    {
                        if ( text[i+j]!=tag[j] )
                            break;
                    }
                    if ( j == tag.length )
                    {
                        if ( this.dialect.softhyphens != undefined 
                            && this.dialect.softhyphens && tag == "-\n" )
                        {
                            text = text.slice(0,i)
                                +'<span class="soft-hyphen">-</span>'
                                +text.slice(i+2);
                            i += 34;
                        }
                        else if ( stack.length>0&&this.peek(stack)==tag )
                        {
                            stack.pop();
                            text = text.slice(0,i)+"</span>"
                                +text.slice(i+tag.length);
                            i += 6 -tag.length;
                        }
                        else
                        {
                            stack.push(tag);
                            text = text.slice(0,i)+'<span class="'
                                +tags[tag]+'" title="'+tags[tag]+'">'
                            +text.slice(i+tag.length);
                            i += 14+(tags[tag].length-tag.length);
                        }
                    }
                }
                i++; 
            }
        }
        // else do nothing
        return text;
    };
    /**
     * Find start of tag after leading white space
     * @param text the text to search
     * @param tag the tag to find at the end
     * @return -1 on failure else index of tag-start at end of text
     */
    this.startPos = function( text, tag )
    {
        var i = 0;
        while ( i<text.length&&(text.charAt(i)=='\t'||text.charAt(i)==' ') )
            i++;
        if ( text.indexOf(tag)==i )
            return i;
        else
            return -1;
    };
    /**
     * Find the last instance of tag before trailing white space
     * @param text the text to search
     * @param tag the tag to find at the end
     * @return -1 on failure else index of tag-start at end of text
     */
    this.endPos = function( text, tag )
    {
        var i = text.length-1;
        while ( i>=0 )
        {
            if ( text[i]==' '||text[i]=='\n'||text[i]=='\t' )
                i--;
            else
                break;
        }
        var j = tag.length-1;
        while ( j >= 0 )
        {
            if ( tag[j] != text[i] )
                break;
            else
            {
                j--;
                i--;
            }
        }
        return (j==-1)?i+1:-1;
    };
    /**
     * Scan the start and end of the paragraph for defined para formats.
     * @param text the text to of the paragraph 
     * @return the possibly modified text with p-formats inserted
     */
    this.processPfmts = function( text )
    {
        if ( this.dialect.paraformats !=undefined )
        {
            var pfmts = this.dialect.paraformats;
            for ( var i=0;i<pfmts.length;i++ )
            {
                var pfmt = pfmts[i];
                if ( pfmt.leftTag != undefined && pfmt.rightTag != undefined )
                {
                    var ltag = pfmt.leftTag;
                    var rtag = pfmt.rightTag;
                    var lpos = this.startPos(text,ltag);
                    var rpos = this.endPos(text,rtag);
                    if (  lpos != -1 && rpos != -1 )
                    {
                        text = '<p class="'+pfmt.prop+'"'
                            +' title="'+pfmt.prop+'">'
                            +text.slice(lpos+ltag.length,rpos)+'</p>';
                        this.formatted = true;
                        break;
                    }
                }
            }
        }
        return text;
    };
    /**
     * Look for four leading white spaces and format as pre
     * @param text the text of the paragraph
     */
    this.processCodeBlocks = function( input )
    {
        if ( this.dialect.codeblocks!=undefined )
        {
            var text = "";
            var lines = input.split("\n");
            var start = false;
            var attr = (this.dialect.codeblocks.prop!=undefined
                &&this.dialect.codeblocks.prop.length>0)
                ?' class="'+this.dialect.codeblocks.prop+'"':"";
            for ( var i=0;i<lines.length;i++ )
            {
                if ( lines[i].indexOf("    ")==0||lines[i].indexOf('\t')==0 )
                {
                    if ( start==false )
                    {
                        text += '<pre'+attr+'>';
                        start = true;
                    }
                    text += lines[i].slice(4)+"\n";
                }
                else
                {
                    if ( start )
                    {
                        text += "</pre>";
                        start = false;
                    }
                    text += lines[i]+"\n";
                }   
            }
            if ( start )
                text += "</pre>\n";
        }
        else
            text = input;
        return text;
    };
    /**
     * Get the quote depth of the current line
     * @paramline the line to test for leading >s
     * @return the number of leading >s followed by spaces
     */
    this.quoteDepth = function( line )
    {
        var state = 0;
        var depth = 0;
        for ( var i=0;i<line.length;i++ )
        {
            var c = line.charAt(i);
            switch ( state )
            {
                case 0: // looking for ">"
                    if ( c=='>' )
                    {
                        depth++;
                        state = 1;
                    }
                    else if ( c!=' '&&c!='\t' )
                        state = -1;
                    break;
                case 1: // looking for obligatory space
                    if ( c==' '||c=='\t' )
                        state = 0;
                    else
                        state = -1;
                    break;
        
            }
            if ( state == -1 )
                break;
        }
        return depth;
    };
    /**
     * Strip the leading quotations from a line
     * @param line
     * @return the line with leading quotations (>s) removed
     */
    this.stripQuotations = function( line )
    {
        var i = 0;
        var c = (line.length>0)?line.charAt(0):undefined;
        if ( this.startPos(line,">")==0 )
        {
            while ( i<line.length && (c=='>'||c=='\t'||c==' ') )
            {
                i++;
                if ( i < line.length )
                    c = line.charAt(i);
            }
        }
        return line.slice(i);
    };
    /**
     * Quotations are lines starting with "> "
     * @param text the text to scan for quotations and convert
     * @return the possibly formatted paragraph
     */
    this.processQuotations = function(text)
    {
        if ( this.dialect.quotations != undefined )
        {
            var old;
            var res = "";
            var attr = (this.dialect.quotations.prop!=undefined
                &&this.dialect.quotations.prop.length>0)
                ?' class="'+this.dialect.quotations.prop+'"':"";
            var stack = new Array();
            var lines = text.split("\n");
            for ( var i=0;i<lines.length;i++ )
            {
                var depth = this.quoteDepth(lines[i]);
                if ( depth > 0 )
                {
                    if ( this.peek(stack) != depth )
                    {
                        if ( stack.length==0||this.peek(stack)<depth )
                        {
                            for ( var j=stack.length;j<depth;j++ )
                                res += "<blockquote"+attr+'>';
                            stack.push(depth);
                        }
                        else if ( depth < this.peek(stack) )
                        {
                            old = stack.pop();
                            while ( old != undefined && old>depth )
                            {
                                res +="</blockquote>";
                                depth = old;
                            }
                        }
                    }
                }
                res += this.stripQuotations(lines[i])+"\n";
            }
            old = this.peek(stack);
            while ( old != undefined && old > 0 )
            {
                old = stack.pop();
                if ( old != undefined )
                    res +="</blockquote>";
            }
            text = res;
            if ( this.startPos(text,"<blockquote")==0 
                && this.endPos(text,"</blockquote>")==text.length-13 )
                this.formatted = true;
        }
        return text;
    };
    /**
     * Does the given line define a heading for the line above?
     * @param line the line to test - should be all the same character
     * @param c the character that should be uniform
     * @return true if it qualifies
     */
    this.isHeading = function( line, c )
    {
        var j = 0;
        for ( ;j<line.length;j++ )
        {
            if ( line.charAt(j) !=c )
                break;  
        }
        return j == line.length;
    };
    /**
     * Is the current line a milestone?
     * @para, line the line to test
     * @param mss an array of milestone defs
     * @return the relevant milestone
     */
    this.isMilestone = function( line, mss )
    {
        var line2 = line.trim();
        for ( var i=0;i<mss.length;i++ )
        {
            var ms = mss[i];
            if ( this.startPos(line2,ms.leftTag)==0 
                && this.endPos(line2,ms.rightTag)==line2.length-ms.rightTag.length )
                return ms;
        }
        return undefined;
    };
    /**
     * Process setext type headings (we don't do atx). Oh, and do milestones.
     * @param text the text to give headings to
     * @return the possibly modified text
     */
    this.processHeadings = function( text )
    {
        if ( this.dialect.headings !=undefined )
        {
            var i,ms,line;
            var res = "";
            var mss = (this.dialect.milestones!=undefined&&this.dialect.milestones.length>0)
                ?this.dialect.milestones:undefined;
            var heads = new Array();
            var tags = new Array();
            for ( i=0;i<this.dialect.headings.length;i++ )
            {
                if ( this.dialect.headings[i].prop != undefined 
                    && this.dialect.headings[i].tag != undefined )
                {
                    heads[this.dialect.headings[i].tag] = this.dialect.headings[i].prop;    
                    tags[this.dialect.headings[i].prop] = 'h'+(i+1);
                }
            }
            var lines = text.split("\n");
            for ( i=0;i<lines.length;i++ )
            {
                line = lines[i];
                if ( i > 0 )
                    this.num_lines++;
                if ( i>0 && line.length > 0 )
                {
                    var prev = lines[i-1];
                    if ( line.charAt(0) in heads )
                    {
                        var j = 0;
                        var c = line.charAt(0);
                        var attr = ' class="'+heads[c]+'" title="'+heads[c]+'"';
                        if ( this.isHeading(line,c) )
                        {
                            // all chars the same
                            res += '<'+tags[heads[c]]+attr+'>'+prev
                                +'</'+tags[heads[c]]+'>\n';  
                            this.formatted = true; 
                        }
                        else 
                            res += prev+'\n';
                    }
                    else if ( prev.length > 0 )
                    {
                        if ( mss != undefined 
                            && this.isMilestone(prev,mss)!=undefined )
                        {
                            ms = this.isMilestone(prev,mss);
                            var ref = prev.slice(ms.leftTag.length,
                                this.endPos(prev,ms.rightTag));
                            if ( ms.prop=="page" )
                                this.page_lines.push(new RefLoc(ref,this.num_lines));
                            res += '<span class="'+ms.prop+'">'
                                +ref+'</span>';
                        }
                        else
                            res += prev+'\n';
                    }
                }
            }
            if ( lines[lines.length-1].length > 0 )
            {
                line = lines[lines.length-1];
                if ( mss != undefined && this.isMilestone(line,mss)!=undefined )
                {
                    ms = this.isMilestone(line,mss);
                    var ref = line.slice(ms.leftTag.length,this.endPos(line,ms.rightTag));
                    if ( ms.prop="page" )
                        this.page_lines.push( new RefLoc(ref,this.num_lines) );
                    res += '<span class="'+ms.prop+'">'+ref+'</span>';
                }
                else if ( !this.isHeading(line,line.charAt(0)) )
                    res += line + "\n";
            }
            text = res;
        }
        return text;
    };
    /**
     * Process an entire paragraph
     * @param text the text to process
     * @return the possibly modified text with HTML codes inserted
     */
    this.processPara = function( text )
    {
        this.formatted = false;
        var attr = (this.dialect.paragraph!=undefined
            &&this.dialect.paragraph.prop!=undefined
            &&this.dialect.paragraph.prop.length>0)
            ?' class="'+this.dialect.paragraph.prop+'" title="'
            +this.dialect.paragraph.prop+'"':"";
        text = this.processSmartQuotes(text);
        text = this.processHeadings(text);
        text = this.processCodeBlocks(text);
        text = this.processQuotations(text);
        text = this.processPfmts(text);
        text = this.processDividers(text);
        text = this.processCfmts(text);
        if ( !this.formatted && text.length > 0 )
            text = '<p'+attr+'>'+text+'</p>';
        return text;
    };
    /**
     * Process all the paras in a section
     * @param section the text of the section
     * @return the modified content of the section
     */
    this.processSection = function( section )
    {
        var html = "";
        var paras = section.split("\n\n");
        for ( var i=0;i<paras.length;i++ )
        {
            if ( i > 0 )
                this.num_lines += 2;
            if ( paras[i].length > 0 )
                html += this.processPara(paras[i]);
        }
        return html;
    };
    /**
     * Convert the MML text into HTML
     * @param text the text to convert
     * @return HTML
     */
    this.toHTML = function(text)
    {
        var html = "";
        var sectionName = (this.dialect.section!=undefined
            &&this.dialect.section.prop!=undefined)
            ?this.dialect.section.prop:"section";
        var sections = text.split("\n\n\n");
        for ( var i=0;i<sections.length;i++ )
        {
            if ( i > 0 )
                this.num_lines += 3;
            html+= '<div class="'+sectionName+'">'
                +this.processSection(sections[i]);
            html += '</div>';
        }
        return html;
    };
    /**
     * Check if we need to update the HTML. Gets called repeatedly.
     */
    this.updateHTML = function()
    {
        if ( this.changed )
        {
            this.num_lines = 0;
            this.page_lines = new Array();
            this.html_lines = new Array();
            var text = $("#"+this.opts.source).val();
            $("#"+this.opts.target).html(this.toHTML(text));
            this.loadImages();
            this.changed = false;
            $(".page").css("display","inline");
            var base = 0;
            var self = this;
            $(".page").each( function(i) {
                if ( base==0 && $(this).offset().top < 0 )
                    base = Math.abs($(this).offset().top);
                self.html_lines.push(new RefLoc($(this).text(),$(this).offset().top+base));
            });
            $(".page").css("display","none");
        }
    };
    /**
     * Find the index of the highest value in the refarray 
     * less than or equal to the given value
     * @param list a sorted array of RefLocs
     * @param value the value of loc to search for
     * @return -1 if no element is less than or equal to, or the index  
     * of the highest element in refarray that is
     */
    this.findHighestIndex = function( list, value )
    {
        var top = 0;
        var bot = list.length-1;
        var mid=0;
        while ( top <= bot )
        {
            mid = Math.floor((top+bot)/2);
            if ( value < list[mid].loc )
            {
                if ( mid == 0 )
                    // value < than first item
                    return -1;  
                else
                    bot = mid-1;
            }
            else    // value >= list[mid].loc
            {
                if ( mid == list.length-1 )
                    // value is >= last item
                    break;
                else if ( value >= list[mid+1].loc )
                    top = mid+1;
                else // list[mid] must be biggest <= value
                    break;
            }
        }
        return mid;
    }
    /**
     * Find the index of the RefLoc in an array
     * @param array the array to look in
     * @param ref the reference value
     * @return the index of that value in the array or -1
     */
    this.findRefIndex = function( array, ref ) {
        for ( var i=0;i<array.length;i++ )
        {
            if ( array[i].ref == ref )
                return i;
        }
        return -1;
    };
    /**
     * Get the page number currently in view and the proportion 
     * of the page visible.
     * @param div the jQuery div object to get scroll info from
     * @param lines the lines array e.g. html_lines
     * @return a string being the ref of the page, comma, and 
     * fraction of page in view
     */
    this.getPixelPage = function( div, lines )
    {
        if ( this.num_lines > 0 && lines.length > 0 )
        {
            var scrollPos = div.scrollTop();
            var scrollHt = div.prop("scrollHeight");
            var divHeight = div.height();
            var padBot = div.css("padding-bottom");
            var padTop = div.css("padding-top");
            var padding = parseInt(padBot)+parseInt(padTop);
            var maximum = scrollHt-(divHeight+padding);
            if ( scrollPos == 0 )
                return lines[0].ref+",0.0";
            else if ( scrollPos == maximum )
                return lines[lines.length-1].ref+",1.0";
            else
            {
                // align on middle of target window
                scrollPos += div.height()/2;
                var index = this.findHighestIndex( lines, scrollPos ); 
                var pixelsOnPage;
                if ( index == -1 )
                {
                    pixelsOnPage = lines[0].loc;
                }
                else if ( index == lines.length-1)
                {
                    pixelsOnPage = div.prop('scrollHeight')-lines[index].loc;
                }  
                else
                {
                    var nextPageStart = lines[index+1].loc;
                    pixelsOnPage = nextPageStart-lines[index].loc;
                }              
                if ( index == -1 )
                    return ",0.0";
                else
                {
                    var fraction = (scrollPos-lines[index].loc)/pixelsOnPage;
                    return lines[index].ref+","+fraction;
                }
            }
        }
        else
            return ",0.0";
    };
    /**
     * Get the source page number currently in view in the textarea, 
     * and the line-number of the central line.
     * @param src the jQuery textarea element
     * @return a string being the ref of the page, comma, and 
     * fraction of page in view
     */
    this.getSourcePage = function( src )
    {
        if ( this.num_lines > 0 && this.page_lines.length > 0 )
        {
            var scrollPos = src.scrollTop();
            var maximum = src.prop("scrollHeight")-src.height();
            if ( scrollPos == 0 )
                return this.page_lines[0].ref+",0.0";
            else if ( scrollPos == maximum )
                return this.page_lines[this.page_lines.length-1].ref+",1.0";
            else
            {
                scrollPos += src.height()/2;
                // convert scrollPos to lines
                var lineHeight = src.prop("scrollHeight")/this.num_lines;
                var linePos = Math.round(scrollPos/lineHeight);
                // find page after which linePos occurs
                var index = this.findHighestIndex(this.page_lines,linePos);
                var linesOnPage;
                if ( index == -1 )
                {
                    linesOnPage = this.page_lines[0].loc;
                }
                else if ( index == this.page_lines.length-1)
                {
                    linesOnPage = this.num_lines-this.page_lines[index].loc;
                }  
                else
                {
                    var nextPageStart = this.page_lines[index+1].loc;
                    linesOnPage = nextPageStart-this.page_lines[index].loc;
                }              
                if ( index == -1 )
                    return ",0.0";
                else
                {
                    var fraction = (linePos-this.page_lines[index].loc)/linesOnPage;
                    return this.page_lines[index].ref+","+fraction;
                }
            }
        }
        else
            return ",0.0";
    };
    /**
     * Load the images. 
     */
    this.loadImages = function() {
        var div = $("#"+this.opts.images);
        // go through the already loaded page numbers in this.page_lines
        if ( !this.imagesLoaded )
        {
            var currHt = 0;
            var num_pages = (opts.data.desc != undefined)?opts.data.desc.length:0;
            for ( var i=0;i<num_pages;i++ )
            {
                var ref = this.opts.data.desc[i].ref;
                var src = this.opts.data.url+"/"+opts.data.prefix
                    +ref+opts.data.suffix;
                div.append('<div class="image"><img src="'+src+'" id="image_'+ref
                    +'" style="width: 100%"; max-width: '
                    +opts.data.desc[i].width+'></div>');
                var divWidth = div.width();
                var scale = divWidth/opts.data.desc[i].width;
                var scaledHeight = Math.floor(opts.data.desc[i].height*(scale));
                this.image_lines.push( new RefLoc(ref,currHt) );    
                currHt += scaledHeight;
            }
            this.imagesLoaded = true;
        }
    };
    /**
     * Scroll to the specified location
     * @param loc the location to scroll to, as {page ref},{fraction}
     * @param lines an array of RefLocs defining page-break positions
     * @param elemToScroll the jQuery element to scroll
     * scale the scale to apply to locs from the lines array to target
     */
    this.scrollTo = function( loc, lines, elemToScroll, scale ) {
        var parts = loc.split(",");
        var pos;
        var index = this.findRefIndex(lines,parts[0]);
        if ( index >= 0 )
            pos = lines[index].loc*scale;
        else
            pos = 0;
        var pageHeight;
        if ( index == -1 )
            pageHeight = 0;
        else if ( index < lines.length-1)
            pageHeight = (lines[index+1].loc*scale)-pos;
        else
            pageHeight = elemToScroll.prop("scrollHeight")-(lines[index].loc*scale);
        pos += Math.round(parseFloat(parts[1])*pageHeight);
        // scrolldown one half-page
        pos -= Math.round(elemToScroll.height()/2);
        if ( pos < 0 )
            pos = 0;
        elemToScroll[0].scrollTop = pos; 
    };
    this.resize = function() {
        var imgObj = $("#"+this.opts.images);
        var srcObj = $("#"+this.opts.source);
        var tgtObj = $("#"+this.opts.target);
        var wHeight = $(window).height();
        var wWidth = $(window).width()-50;
        // compute width
        imgObj.width(Math.floor(wWidth/3));
        tgtObj.width(Math.floor(wWidth/3));
        srcObj.width(Math.floor(wWidth/3));
        // compute height
        var sPadBot = parseInt(srcObj.css("padding-bottom"),10);
        var sPadTop = parseInt(srcObj.css("padding-top"),10);  
        var tPadBot = parseInt(tgtObj.css("padding-bottom"),10);
        var tPadTop = parseInt(tgtObj.css("padding-top"),10);  
        var sBordBot = parseInt(srcObj.css("border-bottom-width"),10);
        var sBordTop = parseInt(srcObj.css("border-top-width"),10);  
        var tBordBot = parseInt(tgtObj.css("border-bottom-width"),10);
        var tBordTop = parseInt(tgtObj.css("border-top-width"),10);  
        imgObj.height(wHeight);
        var tAdjust = tPadBot+tPadTop+tBordBot+tBordTop;
        var sAdjust = sPadBot+sPadTop+sBordBot+sBordTop+2;
        tgtObj.height(wHeight-tAdjust);
        srcObj.height(wHeight-sAdjust);
    };
    // this sets up the timer for updating
    window.setInterval(
        (function(self) {
            return function() {
                self.updateHTML();
            }
        // this should really reset the interval based on how long it took
        })(this),300
    );
    // force update when user modifies the source
    $("#"+opts.source).keyup( 
        (function(self) {
            return function() {
                self.changed = true;
            }
        })(this)
    );
    $("#"+opts.source).scroll( 
        (function(self) {
            return function(e) {
                // prevent feedback
                if ( e.originalEvent )
                {
                    var loc = self.getSourcePage($(this));
                    self.scrollTo(loc,self.html_lines,$("#"+self.opts.target),1.0);
                    self.scrollTo(loc,self.image_lines,$("#"+self.opts.images),1.0);
                }
            }
        })(this)
    );
    $("#"+opts.target).scroll(
        (function(self) {
            return function(e) {
                if ( e.originalEvent )
                {
                    var lineHeight = $("#"+self.opts.source).prop("scrollHeight")/self.num_lines;
                    var loc = self.getPixelPage($(this),self.html_lines);
                    self.scrollTo(loc,self.page_lines,$("#"+self.opts.source),lineHeight);
                    // for some reason this causes feedback, but it works without!!
                    //self.scrollTo(loc,self.image_lines,$("#"+self.opts.images),1.0);
                }
            }
        })(this)
    );
    $("#"+opts.images).scroll(
        (function(self) {
            return function(e) {
                if ( e.originalEvent )
                {
                    var lineHeight = $("#"+self.opts.source).prop("scrollHeight")/self.num_lines;
                    var loc = self.getPixelPage($(this),self.image_lines);
                    self.scrollTo(loc,self.page_lines,$("#"+self.opts.source),lineHeight);
                    self.scrollTo(loc,self.html_lines,$("#"+self.opts.target),1.0);
                }
            }
        })(this)
    );
    // This will execute whenever the window is resized
    $(window).resize(
        (function(self) {
            self.resize();
        })(this)
    );
    /* setup window */
    this.resize();
}
