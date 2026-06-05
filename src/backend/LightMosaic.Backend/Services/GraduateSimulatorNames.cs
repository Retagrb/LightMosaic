namespace LightMosaic.Backend.Services;

/// <summary>~100 unique English names for admin graduate-click simulation.</summary>
public static class GraduateSimulatorNames
{
    private static readonly string[] FirstNames =
    [
        "Emma", "Liam", "Olivia", "Noah", "Ava", "Oliver", "Sophia", "Elijah", "Isabella", "James",
    ];

    private static readonly string[] LastNames =
    [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    ];

    public static IReadOnlyList<string> All { get; } = Build();

    private static List<string> Build()
    {
        var list = new List<string>(FirstNames.Length * LastNames.Length);
        foreach (var first in FirstNames)
        {
            foreach (var last in LastNames)
                list.Add($"{first} {last}");
        }

        return list;
    }
}
