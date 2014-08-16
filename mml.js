/**
 * Implement a VAR param
 */
function Formatted()
{
    this.formatted = false;
}
/**
 * This should be a function of Array
 * @param the Array to test
 * @return the last element of Array, which is NOT modified
 */
function peek( stack )
{
    return (stack.length==0)?undefined:stack[stack.length-1];
}
/**
 * Make a generic divider. It is a table with four cells.
 * @param prop the class name of the table and cell properties
 * @return the HTML table with class names suitable for CSS
 */
function makeDivider( prop )
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
}
/**
 * Process a paragraph for possible dividers
 * @param text the text to process
 * @param opts the dialect options
 * @param form VAR param set to true if the para was a divider
 * @return the possibly modified text
 */
function processDividers(text,opts,form)
{
    if ( opts.dividers!=undefined )
    {
        var divs = opts.dividers;
        for ( var i=0;i<divs.length;i++ )
        {
            var div = divs[i];
            if ( text.trim() == div.tag )
            {
                text = makeDivider( div.prop );
                form.formatted = true;
            }
        }
    }
    return text;
}
/**
 * Get a curly close quote character 
 * @param quote the quote to convert
 * @return the Unicode curly variant
*/
function closeQuote( quote )
{
    if ( quote=="'" )
        return "’";
    else if ( quote == '"' )
        return '”';
    else
        return quote;
}
/**
 * Get a curly openng quote character 
 * @param quote the quote to convert
 * @return the Unicode curly variant
*/
function openQuote( quote )
{
    if ( quote=="'" )
        return "‘";
    else if ( quote == '"' )
        return '“';
    else
        return quote;
}
/**
 * Is this a letter?
 * @param c the char to test
 * @return true if it is
 */
function isLetter( c )
{
    return /\w/g.test(c);
}
/**
 * Is this a curly or straight quote char?
 * @param c the quote to test
 * @return true if it is
 */
function isQuote( c )
{
    return c in quotes;
}
/**
 * Is this a plain space char?
 * @param c the char to test
 * @return true if it is
 */
function isSpace( c )
{
    return c == '\t'||c==' ';
}
/**
 * Is this an opening bracket of some kind?
 * @param c the char to test
 * @return true if it is
 */
function isOpeningBracket(c)
{
    return c=='['||c=='('||c=='{'||c=='<';
}
/**
 * Specifically test for an opening quote char
 * @param c the char to test
 * @return true if it is
 */
function isOpeningQuote(c)
{
    return c=="‘"||c=='“';
}
/**
 * Convert smart quotes as fast as possible. Do this first.
 * @param text the text of a paragraph
 * @param opts the dialect options
 * @return the modified text
 */
function processSmartQuotes( text, opts )
{
    if ( opts.smartquotes )
    {
        for ( var i=0;i<text.length;i++ )
        {
            var c = text[i];
            if ( isQuote(c) )
            {
                var prev = text[i-1];
                if ( i==0||(isSpace(prev)
                    ||isOpeningQuote(prev)||isOpeningBracket(prev)) )
                    text = text.slice(0,i)+openQuote(c)+text.slice(i+1);
                else
                    text = text.slice(0,i)+closeQuote(c)+text.slice(i+1);
            }
        }
    }
    return text;         
}
/**
 * Search for and replace all character formats in the paragraph
 * @param text the text of the paragraph
 * @param opts the options that may contain character format defs
 * @return the possibly modified text with spans inserted
 */ 
function processCfmts(text,opts)
{
    if ( opts.charformats != undefined )
    {
        var cfmts = opts.charformats;
        var tags = new Array();
        var stack = new Array();
        for ( var i=0;i<cfmts.length;i++ )
        {
            var cfmt = cfmts[i];
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
                    if ( tag == "-\n" )
                    {
                        text = text.slice(0,i)
                            +'<span class="soft-hyphen">-</span>'
                            +text.slice(i+2);
                        i += 34;
                    }
                    else if ( stack.length>0&&peek(stack)==tag )
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
}
/**
 * Find start of tag after leading white space
 * @param text the text to search
 * @param tag the tag to find at the end
 * @return -1 on failure else index of tag-start at end of text
 */
function startPos( text, tag )
{
    var i = 0;
    while ( i<text.length&&(text.charAt(i)=='\t'||text.charAt(i)==' ') )
        i++;
    if ( text.indexOf(tag)==i )
        return i;
    else
        return -1;
}
/**
 * Find the last instance of tag before trailing white space
 * @param text the text to search
 * @param tag the tag to find at the end
 * @return -1 on failure else index of tag-start at end of text
 */
function endPos( text, tag )
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
}
/**
 * Scan the start and end of the paragraph for defined para formats.
 * @param text the text to of the paragraph 
 * @param opts the dialect options
 * @param form VAR param set to true if format was inserted
 * @return the possibly modified text with p-formats inserted
 */
function processPfmts( text, opts, form )
{
    if ( opts.paraformats !=undefined )
    {
        var pfmts = opts.paraformats;
        for ( var i=0;i<pfmts.length;i++ )
        {
            var pfmt = pfmts[i];
            if ( pfmt.leftTag != undefined && pfmt.rightTag != undefined )
            {
                var ltag = pfmt.leftTag;
                var rtag = pfmt.rightTag;
                var lpos = startPos(text,ltag);
                var rpos = endPos(text,rtag);
                if (  lpos != -1 && rpos != -1 )
                {
                    text = '<p class="'+pfmt.prop+'"'
                        +' title="'+pfmt.prop+'">'
                        +text.slice(lpos+ltag.length,rpos)+'</p>';
                    form.formatted = true;
                    break;
                }
            }
        }
    }
    return text;
}
/**
 * Look for four leading white spaces and format as pre
 * @param text the text of the paragraph
 * @para opts the MML dialect options
 */
function processCodeBlocks( input, opts )
{
    if ( opts.codeblocks!=undefined )
    {
        var text = "";
        var lines = input.split("\n");
        var start = false;
        var attr = (opts.codeblocks.prop!=undefined
            &&opts.codeblocks.prop.length>0)
            ?' class="'+opts.codeblocks.prop+'"':"";
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
}
/**
 * Get the quote depth of the current line
 * @paramline the line to test for leading >s
 * @return the number of leading >s followed by spaces
 */
function quoteDepth( line )
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
}
/**
 * Strip the leading quotations from a line
 * @param line
 * @return the line with leading quotations (>s) removed
 */
function stripQuotations( line )
{
    var i = 0;
    var c = (line.length>0)?line.charAt(0):undefined;
    if ( startPos(line,">")==0 )
    {
        while ( i<line.length && (c=='>'||c=='\t'||c==' ') )
        {
            i++;
            if ( i < line.length )
                c = line.charAt(i);
        }
    }
    return line.slice(i);
}
/**
 * Quotations are lines starting with "> "
 * @param text the text to scan for quotations and convert
 * @param opts the dialect options
 * @param form VAR param set to true if quotations found at start and end
 * @return the possibly formatted paragraph
 */
function processQuotations(text,opts,form)
{
    if ( opts.quotations != undefined )
    {
        var res = "";
        var attr = (opts.quotations.prop!=undefined
            &&opts.quotations.prop.length>0)
            ?' class="'+opts.quotations.prop+'"':"";
        var stack = new Array();
        var lines = text.split("\n");
        for ( var i=0;i<lines.length;i++ )
        {
            var depth = quoteDepth(lines[i]);
            if ( depth > 0 )
            {
                if ( peek(stack) != depth )
                {
                    if ( stack.length==0||peek(stack)<depth )
                    {
                        for ( var j=stack.length;j<depth;j++ )
                            res += "<blockquote"+attr+'>';
                        stack.push(depth);
                    }
                    else if ( depth < peek(stack) )
                    {
                        var old = stack.pop();
                        while ( old != undefined && old>depth )
                        {
                            res +="</blockquote>";
                            depth = old;
                        }
                    }
                }
            }
            res += stripQuotations(lines[i])+"\n";
        }
        var old = peek(stack);
        while ( old != undefined && old > 0 )
        {
            var old = stack.pop();
            if ( old != undefined )
                res +="</blockquote>";
        }
        text = res;
        if ( startPos(text,"<blockquote")==0 
            && endPos(text,"</blockquote>")==text.length-13 )
            form.formatted = true;
    }
    return text;
}
/**
 * Does the given line define a heading for the line above?
 * @param line the line to test - should be all the same character
 * @param c the character that should be uniform
 * @return true if it qualifies
 */
function isHeading( line, c )
{
    var j = 0;
    for ( ;j<line.length;j++ )
    {
        if ( line.charAt(j) !=c )
            break;  
    }
    return j == line.length;
}
/**
 * Is the current line a milestone?
 * @para, line the line to test
 * @param mss an array of milestone defs
 * @return the relevant milestone
 */
function isMilestone( line, mss )
{
    var line2 = line.trim();
    for ( var i=0;i<mss.length;i++ )
    {
        var ms = mss[i];
        if ( startPos(line2,ms.leftTag)==0 
            && endPos(line2,ms.rightTag)==line2.length-ms.rightTag.length )
            return ms;
    }
    return undefined;
}
/**
 * Process setext type headings (we don't do atx).Oh, and do milestones.
 * @param text the text to give headings to
 * @param opts the dialect options
 * @param form VAR param to set to true if it was a heading
 * @return the possibly modified text
 */
function processHeadings( text, opts, form )
{
    if ( opts.headings !=undefined )
    {
        var res = "";
        var mss = (opts.milestones!=undefined&&opts.milestones.length>0)
            ?opts.milestones:undefined;
        var heads = new Array();
        var tags = new Array();
        for ( var i=0;i<opts.headings.length;i++ )
        {
            if ( opts.headings[i].prop != undefined 
                && opts.headings[i].tag != undefined )
            {
                heads[opts.headings[i].tag] = opts.headings[i].prop;    
                tags[opts.headings[i].prop] = 'h'+(i+1);
            }
        }
        var lines = text.split("\n");
        num_lines += lines.length-1;
        for ( var i=0;i<lines.length;i++ )
        {
            var line = lines[i];
            if ( i>0 && line.length > 0 )
            {
                var prev = lines[i-1];
                if ( line.charAt(0) in heads )
                {
                    var j = 0;
                    var ms;
                    var c = line.charAt(0);
                    var attr = ' class="'+heads[c]+'" title="'+heads[c]+'"';
                    if ( isHeading(line,c) )
                    {
                        // all chars the same
                        res += '<'+tags[heads[c]]+attr+'>'+prev
                            +'</'+tags[heads[c]]+'>\n';  
                        form.formatted = true; 
                    }
                    else 
                        res += prev+'\n';
                }
                else if ( prev.length > 0 )
                {
                    if ( mss != undefined 
                        && isMilestone(prev,mss)!=undefined )
                    {
                        var ms = isMilestone(prev,mss);
                        res += '<span class="'+ms.prop+'">'
                        +line.slice(ms.leftTag.length,endPos(prev,ms.rightTag))
                        +'</span>';
                    }
                    else
                        res += prev+'\n';
                }
            }
        }
        if ( lines[lines.length-1].length > 0 )
        {
            var line = lines[lines.length-1];
            if ( mss != undefined && isMilestone(line,mss)!=undefined )
            {
                var ms = isMilestone(line,mss);
                res += '<span class="'+ms.prop+'">'
                    +line.slice(ms.leftTag.length,endPos(line,ms.rightTag))
                    +'</span>';
            }
            else if ( !isHeading(line,line.charAt(0)) )
                res += line + "\n";
        }
        text = res;
    }
    return text;
}
/**
 * Process an entire paragraph
 * @param text the text to process
 * @param opts the dialect options
 * @return the possibly modified text with HTML codes inserted
 */
function processPara( text, opts )
{
    var form = new Formatted();
    var attr = (opts.paragraph!=undefined
        &&opts.paragraph.prop!=undefined
        &&opts.paragraph.prop.length>0)
        ?' class="'+opts.paragraph.prop+'" title="'
        +opts.paragraph.prop+'"':"";
    text = processSmartQuotes(text,opts);
    text = processHeadings(text,opts,form);
    text = processCodeBlocks(text,opts);
    text = processQuotations(text,opts,form);
    text = processPfmts(text,opts,form);
    text = processDividers(text,opts,form);
    text = processCfmts(text,opts);
    if ( !form.formatted && text.length > 0 )
        text = '<p'+attr+'>'+text+'</p>';
    return text;
}
/**
 * Process all the paras in a section
 * @param section the text of the section
 * @param opts the dialect options
 * @return the modified content of the section
 */
function processSection( section,opts )
{
    var html = "";
    var paras = section.split("\n\n");
    for ( var i=0;i<paras.length;i++ )
    {
        if ( paras[i].length > 0 )
            html += processPara(paras[i],opts);
    }
    num_lines += (paras.length-1)*2;
    return html;
}
var num_lines = 0;
/**
 * Convert the MML text into HTML
 * @param text the text to convert
 * @param opts the dialect options
 * @return HTML
 */
function toHTML(text,opts)
{
    var html = "";
    var sectionName = (opts.section!=undefined&&opts.section.prop!=undefined)
        ?opts.section.prop:"section";
    var sections = text.split("\n\n\n");
    for ( var i=0;i<sections.length;i++ )
    {
        html+= '<div class="'+sectionName+'">'
            +processSection(sections[i],opts);
        html += '</div>';
    }
    num_lines += (sections.length-1)*3;
    return html;
}
