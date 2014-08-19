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
 * An MML Editor provides 2 or 3 panels which are sync-scrolled.
 * In the first panel there is a succession of page-images.
 * In the second an editable text in a minimal markup language (MML).
 * In the third a HTML preview generated from the editable text.
 * The MML diaclet is defined from a JSON opts object.
 * To use it just create one:
 * var editor = new MMLEditor("source","target",opts);
 * @param source the ID of a textarea on the page (no leading "#")
 * @param target the ID of an empty div element (no leading "#")
 * @param opts an MML dialect description in JSON format, see mml-dialect.md
 */
function MMLEditor(source, target, opts) {
    this.changed = true;
    this.quotes = {"'":1,"‘":1,"’":1,'"':1,'”':1,'“':1};
    this.num_lines = 0;
    this.opts = opts;
    this.formatted = false;
    this.page_lines = new Array();
    this.html_lines = new Array();
    this.previous_refs = new Array();
    this.target = target;
    this.src = source;
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
        if ( this.opts.dividers!=undefined )
        {
            var divs = this.opts.dividers;
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
        if ( this.opts.smartquotes )
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
        if ( this.opts.charformats != undefined )
        {
            var cfmts = this.opts.charformats;
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
                        if ( this.opts.softhyphens != undefined 
                            && this.opts.softhyphens && tag == "-\n" )
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
        if ( this.opts.paraformats !=undefined )
        {
            var pfmts = this.opts.paraformats;
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
        if ( this.opts.codeblocks!=undefined )
        {
            var text = "";
            var lines = input.split("\n");
            var start = false;
            var attr = (this.opts.codeblocks.prop!=undefined
                &&this.opts.codeblocks.prop.length>0)
                ?' class="'+this.opts.codeblocks.prop+'"':"";
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
        if ( this.opts.quotations != undefined )
        {
            var old;
            var res = "";
            var attr = (this.opts.quotations.prop!=undefined
                &&this.opts.quotations.prop.length>0)
                ?' class="'+this.opts.quotations.prop+'"':"";
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
        if ( this.opts.headings !=undefined )
        {
            var i,ms,line;
            var res = "";
            var mss = (this.opts.milestones!=undefined&&this.opts.milestones.length>0)
                ?this.opts.milestones:undefined;
            var heads = new Array();
            var tags = new Array();
            for ( i=0;i<this.opts.headings.length;i++ )
            {
                if ( this.opts.headings[i].prop != undefined 
                    && this.opts.headings[i].tag != undefined )
                {
                    heads[this.opts.headings[i].tag] = this.opts.headings[i].prop;    
                    tags[this.opts.headings[i].prop] = 'h'+(i+1);
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
        var attr = (this.opts.paragraph!=undefined
            &&this.opts.paragraph.prop!=undefined
            &&this.opts.paragraph.prop.length>0)
            ?' class="'+this.opts.paragraph.prop+'" title="'
            +this.opts.paragraph.prop+'"':"";
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
        var sectionName = (this.opts.section!=undefined
            &&this.opts.section.prop!=undefined)
            ?this.opts.section.prop:"section";
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
            var text = $("#"+source).val();
            $("#"+target).html(this.toHTML(text));
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
     * less than the given value
     * @param list a sorted array of RefLocs
     * @param value the value of loc to search for
     * @return -1 if no element is less than or the index of the highest 
     * element in refarray that is
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
     * Get the target page number currently in view and the proportion 
     * of the page visible.
     * @param tgt the jQuery div object containing the preview
     * @return a string being the ref of the page, comma, and 
     * fraction of page in view
     */
    this.getHtmlPage = function( tgt )
    {
        if ( this.num_lines > 0 && this.html_lines.length > 0 )
        {
            var scrollPos = tgt.scrollTop();
            var scrollHt = tgt.prop("scrollHeight");
            var tgtHeight = tgt.height();
            var maximum = scrollHt-tgtHeight;
            if ( scrollPos == 0 )
                return this.html_lines[0].ref+",0.0";
            else
            {
                // align on middle of target window
                scrollPos += tgt.height()/2;
                var index = this.findHighestIndex( this.html_lines, scrollPos ); 
                var pixelsOnPage;
                if ( index == -1 )
                {
                    pixelsOnPage = this.html_lines[0].loc;
                }
                else if ( index == this.html_lines.length-1)
                {
                    pixelsOnPage = tgt.prop('scrollHeight')-this.html_lines[index].loc;
                }  
                else
                {
                    var nextPageStart = this.html_lines[index+1].loc;
                    pixelsOnPage = nextPageStart-this.html_lines[index].loc;
                }              
                if ( index == -1 )
                    return ",0.0";
                else
                {
                    var fraction = (scrollPos-this.html_lines[index].loc)/pixelsOnPage;
                    return this.html_lines[index].ref+","+fraction;
                }
            }
        }
        else
            return "0,0.0";
    };
    /**
     * Get the source page number currently in view and the line-number 
     * of the central line.
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
                return this.page_lines[this.page_lines.length-1].ref
                    +",1.0";
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
    window.setInterval(
        (function(self) {
            return function() {
                self.updateHTML();
            }
        })(this),300
    );
    // force update when user modifies the source
    $("#"+source).keyup( 
        (function(self) {
            return function() {
                self.changed = true;
            }
        })(this)
    );
    $("#"+source).scroll( 
        (function(self) {
            return function(e) {
                if (!$("#"+self.src).is(':animated') && e.originalEvent)
                {
                    var loc = self.getSourcePage($(this));
                    var parts = loc.split(",");
                    var pos;
                    var index = self.findRefIndex(self.html_lines,parts[0]);
                    if ( index >= 0 )
                        pos = self.html_lines[index].loc;
                    else
                        pos = 0;
                    var pageHeight;
                    if ( index == -1 )
                        pageHeight = 0;
                    else if ( index < self.html_lines.length-1)
                        pageHeight = self.html_lines[index+1].loc-pos;
                    else
                        pageHeight = $("#"+self.target).prop("scrollHeight")
                            -self.html_lines[index].loc;
                    pos += Math.round(parseFloat(parts[1])*pageHeight);
                    var target = $("#"+self.target);
                    // scrolldown one half-page
                    pos -= Math.round(target.height()/2);
                    if ( pos < 0 )
                        pos = 0;
                    target.animate({scrollTop: pos}, 20, "linear"); 
                }
            }
        })(this)
    );
    $("#"+target).scroll(
        (function(self) {
            return function(e) {
                if ( !$("#"+self.target).is(':animated') && e.originalEvent ) 
                {
                    var loc = self.getHtmlPage($(this));
                    var parts = loc.split(",");
                    var pos;
                    var index = self.findRefIndex(self.page_lines,parts[0]);
                    var lineHeight = $("#"+self.src).prop("scrollHeight")/self.num_lines;
                    if ( index >= 0 )
                        pos = self.page_lines[index].loc*lineHeight;
                    else
                        pos = 0;
                    var pageHeight;
                    if ( index == -1 )
                        pageHeight = 0;
                    else if ( index < self.page_lines.length-1)
                        pageHeight = (self.page_lines[index+1].loc*lineHeight)-pos;
                    else
                        pageHeight = $("#"+self.src).prop("scrollHeight")
                            -(self.page_lines[index].loc*lineHeight);
                    pos += Math.round(parseFloat(parts[1])*pageHeight);
                    var source = $("#"+self.src);
                    // scrolldown one half-page
                    pos -= Math.round(source.height()/2);
                    if ( pos < 0 )
                        pos = 0;
                    source.animate({scrollTop: pos}, 20, "linear"); 
                }
            }
        })(this)
    );
};
