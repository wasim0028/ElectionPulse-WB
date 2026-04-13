using ElectionAPI.Data;
using ElectionAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ElectionAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ElectionController : ControllerBase
    {
        private readonly ElectionDbContext _db;

        private static readonly Dictionary<string, string> PartyColors =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["AITC"]    = "#20C997",
                ["TMC"]     = "#20C997",
                ["BJP"]     = "#FF6B35",
                ["INC"]     = "#2563EB",
                ["CPI(M)"]  = "#E63946",
                ["CPIM"]    = "#E63946",
                ["CPI"]     = "#C1121F",
                ["RSP"]     = "#9D4EDD",
                ["SUCI"]    = "#7B2D8B",
                ["BSP"]     = "#457B9D",
                ["ISF"]     = "#06D6A0",
                ["AIFB"]    = "#F59E0B",
                ["NOTA"]    = "#6B7280",
                ["IND"]     = "#ADB5BD",
                ["AMB"]     = "#8B5CF6",
                ["KPPU"]    = "#10B981",
            };

        public static string GetColor(string? party)
        {
            if (string.IsNullOrWhiteSpace(party)) return "#6B7280";
            foreach (var kv in PartyColors)
                if (party.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
                    return kv.Value;
            return "#6B7280";
        }

        // Exact gender values from DB: "MALE", "FEMALE", "NOTA"
        private static bool IsFemale(string? g) =>
            string.Equals(g?.Trim(), "FEMALE", StringComparison.OrdinalIgnoreCase);
        private static bool IsMale(string? g) =>
            string.Equals(g?.Trim(), "MALE", StringComparison.OrdinalIgnoreCase);
        private static bool IsNota(string? g) =>
            string.Equals(g?.Trim(), "NOTA", StringComparison.OrdinalIgnoreCase);

        public ElectionController(ElectionDbContext db) => _db = db;

        // ── GET /api/election/constituencies?search= ──────────────────────────
        [HttpGet("constituencies")]
        public async Task<ActionResult<IEnumerable<ConstituencyListDto>>> GetConstituencies(
            [FromQuery] string? search)
        {
            var allWinners = await _db.ElectionWB2026
                .AsNoTracking()
                .Where(x => x.Rank == 1)
                .ToListAsync();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                // Search by name OR by ID number
                bool isId = int.TryParse(q, out int searchId);
                allWinners = allWinners
                    .Where(x => isId
                        ? x.ConstituencyId == searchId
                        : (x.ConstituencyName ?? "").Contains(q, StringComparison.OrdinalIgnoreCase) ||
                          (x.ConstituencyBengali ?? "").Contains(q, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            var ids = allWinners
                .Where(w => w.ConstituencyId.HasValue)
                .Select(w => w.ConstituencyId!.Value)
                .ToList();

            var runnerUps = await _db.ElectionWB2026
                .AsNoTracking()
                .Where(x => x.ConstituencyId != null &&
                            ids.Contains(x.ConstituencyId.Value) &&
                            x.Rank == 2)
                .ToListAsync();

            var ruDict = runnerUps
                .Where(x => x.ConstituencyId.HasValue)
                .ToDictionary(x => x.ConstituencyId!.Value, x => x.VotesTotal ?? 0);

            var result = allWinners
                .Where(w => w.ConstituencyId.HasValue)
                .OrderBy(w => w.ConstituencyId)
                .Select(w =>
                {
                    var wVotes = w.VotesTotal ?? 0;
                    var margin = ruDict.TryGetValue(w.ConstituencyId!.Value, out var ru)
                        ? wVotes - ru : wVotes;
                    return new ConstituencyListDto(
                        w.ConstituencyId!.Value,
                        w.ConstituencyName ?? "",
                        w.ConstituencyBengali,
                        w.CandidateName ?? "",
                        w.CandidateNameBengali,
                        w.PartyName ?? "",
                        w.Gender,
                        w.Age,
                        w.Category,
                        wVotes,
                        w.TotalElectors ?? 0,
                        (decimal)(w.VotePercentage ?? 0),
                        margin
                    );
                });

            return Ok(result);
        }

        // ── GET /api/election/constituencies/{id} ─────────────────────────────
        [HttpGet("constituencies/{id:int}")]
        public async Task<ActionResult<ConstituencyDetailDto>> GetConstituency(int id)
        {
            var rows = await _db.ElectionWB2026
                .AsNoTracking()
                .Where(x => x.ConstituencyId == id)
                .OrderBy(x => x.Rank)
                .ToListAsync();

            if (!rows.Any()) return NotFound();

            var winner   = rows.FirstOrDefault(r => r.Rank == 1);
            var runnerUp = rows.FirstOrDefault(r => r.Rank == 2);
            if (winner is null) return NotFound();

            var totalCast = rows.Sum(r => (long)(r.VotesTotal ?? 0));
            var wVotes    = winner.VotesTotal ?? 0;
            var margin    = runnerUp is not null ? wVotes - (runnerUp.VotesTotal ?? 0) : wVotes;
            var electors  = winner.TotalElectors ?? 0;
            var turnout   = electors > 0
                ? Math.Round((decimal)totalCast / electors * 100, 2) : 0;

            var candidates = rows.Select(r => new CandidateDto(
                r.Rank ?? 0,
                r.CandidateName ?? "",
                r.CandidateNameBengali,
                r.Gender,
                r.Age,
                r.Category,
                r.PartyName ?? "",
                r.VotesGeneral ?? 0,
                r.VotesPostal  ?? 0,
                r.VotesTotal   ?? 0,
                (decimal)(r.VotePercentage ?? 0)
            )).ToList();

            return Ok(new ConstituencyDetailDto(
                winner.ConstituencyId ?? 0,
                winner.ConstituencyName ?? "",
                winner.ConstituencyBengali,
                electors,
                (int)totalCast,
                turnout,
                margin,
                candidates
            ));
        }

        // ── GET /api/election/constituencies/{id}/chart ───────────────────────
        [HttpGet("constituencies/{id:int}/chart")]
        public async Task<ActionResult<IEnumerable<PieSliceDto>>> GetConstituencyChart(int id)
        {
            var rows = await _db.ElectionWB2026
                .AsNoTracking()
                .Where(x => x.ConstituencyId == id)
                .ToListAsync();

            if (!rows.Any()) return NotFound();

            var slices = rows
                .GroupBy(r => r.PartyName ?? "Unknown")
                .Select(g => new PieSliceDto(
                    g.Key,
                    g.Sum(r => (long)(r.VotesTotal ?? 0)),
                    GetColor(g.Key)
                ))
                .OrderByDescending(s => s.Value)
                .ToList();

            return Ok(slices);
        }

        // ── GET /api/election/parties ─────────────────────────────────────────
        [HttpGet("parties")]
        public async Task<ActionResult<IEnumerable<PartySummaryDto>>> GetParties()
        {
            var all = await _db.ElectionWB2026.AsNoTracking().ToListAsync();

            var seats = all
                .Where(r => r.Rank == 1)
                .GroupBy(r => r.PartyName ?? "Unknown")
                .ToDictionary(g => g.Key, g => g.Count());

            var result = all
                .GroupBy(r => r.PartyName ?? "Unknown")
                .Select(g => new PartySummaryDto(
                    g.Key,
                    seats.GetValueOrDefault(g.Key, 0),
                    g.Sum(r => (long)(r.VotesTotal ?? 0)),
                    GetColor(g.Key)
                ))
                .OrderByDescending(x => x.SeatsWon)
                .ThenByDescending(x => x.TotalVotes)
                .ToList();

            return Ok(result);
        }

        // ── GET /api/election/chart/seats ─────────────────────────────────────
        [HttpGet("chart/seats")]
        public async Task<ActionResult<IEnumerable<PieSliceDto>>> GetSeatsChart()
        {
            var winners = await _db.ElectionWB2026
                .AsNoTracking()
                .Where(x => x.Rank == 1)
                .ToListAsync();

            var slices = winners
                .GroupBy(r => r.PartyName ?? "Unknown")
                .Select(g => new PieSliceDto(g.Key, (long)g.Count(), GetColor(g.Key)))
                .OrderByDescending(s => s.Value)
                .ToList();

            return Ok(slices);
        }

        // ── GET /api/election/chart/votes ─────────────────────────────────────
        [HttpGet("chart/votes")]
        public async Task<ActionResult<IEnumerable<PieSliceDto>>> GetVotesChart()
        {
            var all = await _db.ElectionWB2026.AsNoTracking().ToListAsync();

            var slices = all
                .GroupBy(r => r.PartyName ?? "Unknown")
                .Select(g => new PieSliceDto(
                    g.Key,
                    g.Sum(r => (long)(r.VotesTotal ?? 0)),
                    GetColor(g.Key)
                ))
                .OrderByDescending(s => s.Value)
                .ToList();

            return Ok(slices);
        }

        // ── GET /api/election/stats ───────────────────────────────────────────
        [HttpGet("stats")]
        public async Task<ActionResult> GetStats()
        {
            var all     = await _db.ElectionWB2026.AsNoTracking().ToListAsync();
            var winners = all.Where(r => r.Rank == 1).ToList();

            // Use exact DB values: "MALE", "FEMALE", "NOTA"
            var femaleWinners = winners.Count(r => IsFemale(r.Gender));
            var maleWinners   = winners.Count(r => IsMale(r.Gender));
            var femaleCount   = all.Count(r => IsFemale(r.Gender));
            var maleCount     = all.Count(r => IsMale(r.Gender));
            var notaCount     = all.Count(r => IsNota(r.Gender));

            var totalConstituencies = winners.Count;
            var totalVotesCast      = all.Sum(r => (long)(r.VotesTotal ?? 0));
            var totalElectors       = winners.Sum(r => (long)(r.TotalElectors ?? 0));
            var avgTurnout          = totalElectors > 0
                ? Math.Round((double)totalVotesCast / totalElectors * 100, 2) : 0;
            var totalCandidates = all.Count;
            var totalParties    = all
                .Select(r => r.PartyName ?? "")
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Distinct().Count();

            return Ok(new
            {
                totalConstituencies,
                totalVotesCast,
                totalElectors,
                avgTurnout,
                totalCandidates,
                totalParties,
                femaleWinners,
                maleWinners,
                femaleCount,
                maleCount,
                notaCount
            });
        }

        // ── GET /api/election/gender ──────────────────────────────────────────
        // Full gender breakdown: all candidates split by MALE / FEMALE / NOTA
        [HttpGet("gender")]
        public async Task<ActionResult> GetGenderBreakdown()
        {
            var all     = await _db.ElectionWB2026.AsNoTracking().ToListAsync();
            var winners = all.Where(r => r.Rank == 1).ToList();

            // ── Female candidates ─────────────────────────────────────────────
            var femaleCandidates = all
                .Where(r => IsFemale(r.Gender))
                .OrderBy(r => r.ConstituencyId)
                .ThenBy(r => r.Rank)
                .Select(r => new
                {
                    constituencyId   = r.ConstituencyId,
                    constituencyName = r.ConstituencyName ?? "",
                    candidateName    = r.CandidateName ?? "",
                    partyName        = r.PartyName ?? "",
                    rank             = r.Rank ?? 0,
                    votesTotal       = r.VotesTotal ?? 0,
                    votePercentage   = Math.Round(r.VotePercentage ?? 0, 2),
                    isWinner         = r.Rank == 1,
                    partyColor       = GetColor(r.PartyName)
                })
                .ToList();

            // ── Male candidates ───────────────────────────────────────────────
            var maleCandidates = all
                .Where(r => IsMale(r.Gender))
                .OrderBy(r => r.ConstituencyId)
                .ThenBy(r => r.Rank)
                .Select(r => new
                {
                    constituencyId   = r.ConstituencyId,
                    constituencyName = r.ConstituencyName ?? "",
                    candidateName    = r.CandidateName ?? "",
                    partyName        = r.PartyName ?? "",
                    rank             = r.Rank ?? 0,
                    votesTotal       = r.VotesTotal ?? 0,
                    votePercentage   = Math.Round(r.VotePercentage ?? 0, 2),
                    isWinner         = r.Rank == 1,
                    partyColor       = GetColor(r.PartyName)
                })
                .ToList();

            // ── Winner gender map (constituency → winner gender) ──────────────
            var winnerGenderMap = winners
                .Where(w => w.ConstituencyId.HasValue)
                .Select(w => new
                {
                    constituencyId   = w.ConstituencyId!.Value,
                    constituencyName = w.ConstituencyName ?? "",
                    candidateName    = w.CandidateName ?? "",
                    partyName        = w.PartyName ?? "",
                    gender           = w.Gender ?? "",
                    isFemaleWinner   = IsFemale(w.Gender),
                    isMaleWinner     = IsMale(w.Gender),
                    votesTotal       = w.VotesTotal ?? 0,
                    votePercentage   = Math.Round(w.VotePercentage ?? 0, 2),
                    partyColor       = GetColor(w.PartyName)
                })
                .OrderBy(w => w.constituencyId)
                .ToList();

            // ── Summary ───────────────────────────────────────────────────────
            var summary = new
            {
                totalCandidates   = all.Count,
                femaleCandidates  = femaleCandidates.Count,
                maleCandidates    = maleCandidates.Count,
                notaCandidates    = all.Count(r => IsNota(r.Gender)),
                femaleWinners     = winners.Count(r => IsFemale(r.Gender)),
                maleWinners       = winners.Count(r => IsMale(r.Gender)),
                femaleWinPercent  = Math.Round(
                    femaleCandidates.Count > 0
                        ? (double)winners.Count(r => IsFemale(r.Gender)) / femaleCandidates.Count * 100
                        : 0, 1),
                maleWinPercent    = Math.Round(
                    maleCandidates.Count > 0
                        ? (double)winners.Count(r => IsMale(r.Gender)) / maleCandidates.Count * 100
                        : 0, 1),
            };

            return Ok(new { summary, femaleCandidates, maleCandidates, winnerGenderMap });
        }
    }
}
