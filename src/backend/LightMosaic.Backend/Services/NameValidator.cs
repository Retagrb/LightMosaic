using System.Text.RegularExpressions;

namespace LightMosaic.Backend.Services;

public static partial class NameValidator
{
    private static readonly Regex HtmlTagPattern = HtmlTagRegex();
    private static readonly Regex EmojiPattern = EmojiRegex();
    private static readonly Regex ChineseNamePattern = ChineseNameRegex();
    private static readonly Regex EnglishNamePattern = EnglishNameRegex();

    public static bool TryValidate(string? raw, out string name, out string error)
    {
        name = string.Empty;
        error = string.Empty;

        if (string.IsNullOrWhiteSpace(raw))
        {
            error = "请输入姓名";
            return false;
        }

        name = raw.Trim();

        if (HtmlTagPattern.IsMatch(name) || EmojiPattern.IsMatch(name))
        {
            error = "姓名包含不允许的字符";
            return false;
        }

        if (ChineseNamePattern.IsMatch(name))
            return true;

        if (EnglishNamePattern.IsMatch(name))
            return true;

        error = "姓名格式不正确（中文 2–8 字，或英文 2–20 个字母/空格）";
        return false;
    }

    [GeneratedRegex(@"<[^>]+>", RegexOptions.CultureInvariant)]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"[\uD83C-\uDBFF\uDC00-\uDFFF]+", RegexOptions.CultureInvariant)]
    private static partial Regex EmojiRegex();

    [GeneratedRegex(@"^[\u4e00-\u9fff]{2,8}$", RegexOptions.CultureInvariant)]
    private static partial Regex ChineseNameRegex();

    [GeneratedRegex(@"^[A-Za-z][A-Za-z\s]{0,18}[A-Za-z]$|^[A-Za-z]{2,20}$", RegexOptions.CultureInvariant)]
    private static partial Regex EnglishNameRegex();
}
