namespace ElectionAPI.Models
{
    // ── Search / list ─────────────────────────────────────────────────────────
    /// <summary>One constituency summary (winner row only).</summary>
    public record ConstituencyListDto(
        int     ConstituencyId,
        string  ConstituencyName,
        string? ConstituencyBengali,
        string  WinnerName,
        string? WinnerNameBengali,
        string  PartyName,
        string? Gender,
        int?    Age,
        string? Category,
        int     WinnerVotes,
        int     TotalElectors,
        decimal VotePercentage,
        int     Margin           // winner votes − runner-up votes
    );

    // ── Full constituency detail ──────────────────────────────────────────────
    /// <summary>All candidates in one constituency, ordered by rank.</summary>
    public record ConstituencyDetailDto(
        int                   ConstituencyId,
        string                ConstituencyName,
        string?               ConstituencyBengali,
        int                   TotalElectors,
        int                   TotalVotesCast,        // sum of all VOTES_TOTAL in constituency
        decimal               Turnout,               // TotalVotesCast / TotalElectors * 100
        int                   Margin,
        List<CandidateDto>    Candidates
    );

    public record CandidateDto(
        int     Rank,
        string  CandidateName,
        string? CandidateNameBengali,
        string? Gender,
        int?    Age,
        string? Category,
        string  PartyName,
        int     VotesGeneral,
        int     VotesPostal,
        int     VotesTotal,
        decimal VotePercentage
    );

    // ── Pie / chart ───────────────────────────────────────────────────────────
    /// <summary>One slice in a Recharts PieChart.</summary>
    public record PieSliceDto(string Name, long Value, string Fill);

    // ── Party summary (aggregate) ─────────────────────────────────────────────
    public record PartySummaryDto(
        string PartyName,
        int    SeatsWon,
        long   TotalVotes,
        string Fill
    );

    // ── Gender / category breakdown ───────────────────────────────────────────
    public record BreakdownDto(string Label, int Count);
}
