namespace ElectionAPI.Models
{
    /// <summary>
    /// Maps to Election_WB_2026.
    /// Every column is IS_NULLABLE=YES in SQL Server, so all value types are nullable.
    /// </summary>
    public class ElectionWB2026
    {
        public int?    ConstituencyId         { get; set; }
        public string? ConstituencyName       { get; set; }
        public string? ConstituencyBengali    { get; set; }
        public int?    Rank                   { get; set; }
        public string? CandidateName          { get; set; }
        public string? CandidateNameBengali   { get; set; }
        public string? Gender                 { get; set; }
        public int?    Age                    { get; set; }
        public string? Category               { get; set; }
        public string? PartyName              { get; set; }
        public int?    VotesGeneral           { get; set; }
        public int?    VotesPostal            { get; set; }
        public int?    VotesTotal             { get; set; }
        public double? VotePercentage         { get; set; }   // float in SQL
        public int?    TotalElectors          { get; set; }
    }
}
